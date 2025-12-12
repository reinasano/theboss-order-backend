// routes/orderRoutes.js
const express = require('express');
const router = express.Router();
const Order = require('../models/Order'); // Import Schema

// *****************************************************************
// 1. GET /api/orders: ดึงรายการคำสั่งซื้อ (รองรับ Date และ Status Filter)
// *****************************************************************
router.get('/', async (req, res) => {
    try {
        const { date, status } = req.query; // ดึงค่า date และ status จาก URL Query Parameters
        const query = {};

        // A. กรองตามสถานะ (Status Filtering)
        if (status) {
            query.status = status;
        }

        // B. กรองตามวันที่ (Date Filtering) *** Logic ที่เราต้องการ ***
        if (date) {
            // 1. แปลงวันที่ (YYYY-MM-DD) ที่ได้จาก Frontend ให้เป็นช่วงเวลา
            const startOfDay = new Date(date);
            startOfDay.setHours(0, 0, 0, 0); // ตั้งเวลาเป็น 00:00:00.000
            
            const endOfDay = new Date(date);
            endOfDay.setHours(23, 59, 59, 999); // ตั้งเวลาเป็น 23:59:59.999
            
            // 2. ใช้เงื่อนไข $gte และ $lte กับฟิลด์ createdAt ที่ Mongoose สร้างไว้
            query.createdAt = {
                $gte: startOfDay,
                $lte: endOfDay
            };
        }

        const orders = await Order.find(query).sort({ createdAt: -1 }); // ดึงข้อมูลล่าสุดก่อน
        res.status(200).json(orders);
    } catch (error) {
        console.error('Error fetching orders:', error);
        res.status(500).json({ message: 'Failed to fetch orders', error: error.message });
    }
});

// *****************************************************************
// 2. POST /api/orders: สร้างคำสั่งซื้อใหม่
// *****************************************************************
router.post('/', async (req, res) => {
    try {
        const newOrder = new Order(req.body); // รับข้อมูลจาก Frontend
        const savedOrder = await newOrder.save();

        res.status(201).json({
            message: 'Order placed successfully',
            orderId: savedOrder.orderId, 
            order: savedOrder
        });
    } catch (error) {
        console.error('Error placing order:', error);
        // Error 400 สำหรับ Bad Request (เช่น ข้อมูลไม่ครบหรือสถานะไม่ถูกต้อง)
        res.status(400).json({ message: 'Failed to place order', error: error.message });
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
            // {new: true} จะคืนค่าเอกสารที่อัปเดตแล้ว
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