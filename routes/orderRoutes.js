// routes/orderRoutes.js
const express = require('express');
const router = express.Router();
const Order = require('../models/Order'); // Import Schema
const axios = require('axios'); // <-- ใช้ Axios แทน node-fetch

// *****************************************************************
// 1. ตั้งค่า: Google Apps Script Web App URL
// *****************************************************************
// **แทนที่ URL นี้ด้วย URL ที่คุณ Deploy จาก Google Apps Script**
const GOOGLE_SHEET_URL = 'https://script.google.com/macros/s/AKfycbxFEAJ5rhQ3XjVpZ9PinwzN0Pae2qSJiIXAbLPUTPJORAp4g65QbxL99m3pNZGBMFWeow/exec'; 


/**
 * ฟังก์ชันสำหรับส่งข้อมูลการสั่งซื้อ (รายรับ) ไปยัง Google Sheet
 * @param {object} orderData - ข้อมูลคำสั่งซื้อที่บันทึกสำเร็จจาก MongoDB
 */
const logToGoogleSheet = async (orderData) => {
    // Logic การจำแนก Category: ตรวจสอบจากชื่อสินค้าตัวแรก
    const firstItemName = orderData.orderDetails[0].name.toLowerCase();
    
    // ปรับ Logic นี้ตามชื่อสินค้าจริงในระบบของคุณ
    const isMeat = firstItemName.includes('เนื้อ') || firstItemName.includes('ไก่') || firstItemName.includes('หมู');
    const category = isMeat ? 'meat' : 'veg'; 

    const transactionData = {
        category: category, 
        type: 'รายรับ', // การสั่งซื้อถือเป็นรายรับ
        description: `ยอดขาย #${orderData.orderId}`,
        amount: orderData.totalAmount,
        notes: `ร้าน: ${orderData.customerNote} / เวลารับ: ${orderData.pickupTime}`
    };

    try {
        // -----------------------------------------------------------------
        // **ใช้ AXIOS ในการส่ง POST Request**
        // -----------------------------------------------------------------
        const response = await axios.post(GOOGLE_SHEET_URL, transactionData, {
            headers: { 'Content-Type': 'application/json' }
        });
        
        const result = response.data; // Axios เก็บผลลัพธ์ใน response.data
        
        if (result.result === 'success') {
            console.log(`✅ Google Sheet Log Success (${category}): ${transactionData.amount}`);
        } else {
            console.error('❌ Google Sheet Log Failed (Sheet Error):', result.message);
        }
    } catch (error) {
        // ข้อผิดพลาดในการเชื่อมต่อ (เช่น URL ผิด, Server ไม่ตอบสนอง)
        console.error('❌ Error sending data to Google Sheet (Connection):', error.message);
    }
};


// *****************************************************************
// 2. GET /api/orders: ดึงรายการคำสั่งซื้อ
// *****************************************************************
router.get('/', async (req, res) => {
    try {
        const { date, status } = req.query; 
        const query = {};

        if (status) {
            query.status = status;
        }

        if (date) {
            const startOfDay = new Date(date);
            startOfDay.setHours(0, 0, 0, 0); 
            
            const endOfDay = new Date(date);
            endOfDay.setHours(23, 59, 59, 999); 
            
            query.createdAt = {
                $gte: startOfDay,
                $lte: endOfDay
            };
        }

        const orders = await Order.find(query).sort({ createdAt: -1 }); 
        res.status(200).json(orders);
    } catch (error) {
        console.error('Error fetching orders:', error);
        res.status(500).json({ message: 'Failed to fetch orders', error: error.message });
    }
});

// *****************************************************************
// 3. POST /api/orders: สร้างคำสั่งซื้อใหม่ (พร้อม Log ไป Google Sheet)
// *****************************************************************
router.post('/', async (req, res) => {
    try {
        const newOrder = new Order(req.body); 
        const savedOrder = await newOrder.save();

        // ----------------------------------------------------
        // **ส่วนที่เพิ่มใหม่: บันทึกข้อมูลไปยัง Google Sheet**
        // ----------------------------------------------------
        // ไม่ต้องรอ await เพื่อให้ Client ได้รับคำตอบเร็วขึ้น (Non-blocking)
        logToGoogleSheet(savedOrder); 
        // ----------------------------------------------------


        res.status(201).json({
            message: 'Order placed successfully',
            orderId: savedOrder.orderId, 
            order: savedOrder
        });
    } catch (error) {
        console.error('Error placing order:', error);
        
        let errorMessage = 'Failed to place order (Unknown Server Error)'; 
        
        if (error.name === 'ValidationError') {
            const errors = Object.values(error.errors).map(err => err.message);
            errorMessage = `Validation failed: ${errors.join(' | ')}`; 
        } else {
             errorMessage = error.message;
        }

        res.status(400).json({ 
            message: 'Failed to place order', 
            error: errorMessage 
        });
    }
});

// *****************************************************************
// 4. GET /api/orders/:orderId: ตรวจสอบสถานะ (ใช้โดยลูกค้า)
// *****************************************************************
router.get('/:orderId', async (req, res) => {
    try {
        const order = await Order.findOne({ orderId: req.params.orderId.toUpperCase() });

        if (!order) {
            return res.status(404).json({ message: 'Order ID not found' });
        }
        
        res.status(200).json({
            orderId: order.orderId,
            status: order.status,
            customerNote: order.customerNote,
            pickupTime: order.pickupTime,
            totalAmount: order.totalAmount,
            createdAt: order.createdAt 
        });
    } catch (error) {
        console.error('Error checking order status:', error);
        res.status(500).json({ message: 'Error checking status', error: error.message });
    }
});


// *****************************************************************
// 5. PUT /api/orders/:orderId: อัปเดตสถานะ (ใช้โดย Admin)
// *****************************************************************
router.put('/:orderId', async (req, res) => {
    try {
        const { status } = req.body;
        
        if (!status) {
            return res.status(400).json({ message: 'Status field is required for update.' });
        }

        const updatedOrder = await Order.findOneAndUpdate(
            { orderId: req.params.orderId.toUpperCase() },
            { status: status },
            { new: true, runValidators: true } 
        );

        if (!updatedOrder) {
            return res.status(404).json({ message: 'Order ID not found for update.' });
        }

        res.status(200).json({
            message: 'Order status updated successfully',
            order: updatedOrder
        });

    } catch (error) {
        console.error('Error updating order status:', error);
        res.status(400).json({ message: 'Failed to update order status', error: error.message });
    }
});

module.exports = router;