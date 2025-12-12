// routes/orderRoutes.js
const express = require('express');
const router = express.Router();
const Order = require('../models/Order'); // Import Schema

// *****************************************************************
// 1. GET /api/orders: ดึงรายการคำสั่งซื้อ (รองรับ Date และ Status Filter)
// *****************************************************************
router.get('/', async (req, res) => {
    try {
        const { date, status } = req.query; 
        const query = {};

        // A. กรองตามสถานะ (Status Filtering)
        if (status) {
            query.status = status;
        }

        // B. กรองตามวันที่ (Date Filtering)
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
// 2. POST /api/orders: สร้างคำสั่งซื้อใหม่ (แก้ไขการจัดการ Error Validation)
// *****************************************************************
router.post('/', async (req, res) => {
    // Console.log ที่นี่จะช่วยให้คุณเห็นข้อมูลที่ Client ส่งมาใน Log ของ Render
    // console.log('Incoming order body:', req.body); 
    try {
        const newOrder = new Order(req.body); 
        const savedOrder = await newOrder.save();

        res.status(201).json({
            message: 'Order placed successfully',
            orderId: savedOrder.orderId, 
            order: savedOrder
        });
    } catch (error) {
        console.error('Error placing order:', error);
        
        let errorMessage = 'Failed to place order (Unknown Server Error)'; 
        
        // ตรวจสอบว่าเป็น Mongoose Validation Error หรือไม่ (สาเหตุหลักของ 400)
        if (error.name === 'ValidationError') {
            // ดึงข้อความ error ที่ละเอียดจาก Mongoose (เช่น บอกว่าฟิลด์ไหนขาดหายไป)
            const errors = Object.values(error.errors).map(err => err.message);
            // แสดงข้อความ error แรกที่ชัดเจน
            errorMessage = `Validation failed: ${errors.join(' | ')}`; 
        } else {
             errorMessage = error.message;
        }

        // ส่ง Error 400 กลับไปพร้อมข้อความที่ชัดเจน
        res.status(400).json({ 
            message: 'Failed to place order', 
            error: errorMessage 
        });
    }
});

// *****************************************************************
// 3. GET /api/orders/:orderId: ตรวจสอบสถานะ (ใช้โดยลูกค้า)
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
// 4. PUT /api/orders/:orderId: อัปเดตสถานะ (ใช้โดย Admin)
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