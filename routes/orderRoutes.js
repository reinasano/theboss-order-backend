// routes/orderRoutes.js
const express = require('express');
const router = express.Router();
const Order = require('../models/Order'); 

// *****************************************************************
// 1. GET /api/orders: ดึงรายการคำสั่งซื้อ (Admin)
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
// 2. POST /api/orders: สร้างคำสั่งซื้อใหม่
// *****************************************************************
router.post('/', async (req, res) => {
    try {
        const newOrder = new Order(req.body); 
        const savedOrder = await newOrder.save();
        // ลบส่วน Google Sheet Log ออกไป

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
// 4. PUT /api/orders/:orderId: อัปเดตสถานะ (Admin)
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


// *****************************************************************
// 5. GET /api/orders/summary/weekly: สรุปยอดขายรายสัปดาห์ (Admin Function)
// *****************************************************************
router.get('/summary/weekly', async (req, res) => {
    try {
        // 1. กำหนดช่วงเวลา (สัปดาห์ปัจจุบัน เริ่มต้นวันจันทร์)
        const now = new Date();
        const dayOfWeek = now.getDay(); // 0=อาทิตย์, 1=จันทร์, ..., 6=เสาร์
        const diff = (dayOfWeek === 0) ? 6 : dayOfWeek - 1; 
        
        const startOfWeek = new Date(now.setDate(now.getDate() - diff)); 
        startOfWeek.setHours(0, 0, 0, 0);

        // 2. ดึงข้อมูลคำสั่งซื้อที่ถือว่าเป็นรายรับในสัปดาห์นี้
        const orders = await Order.find({
            status: { $in: ['Completed', 'Processing'] }, 
            createdAt: { $gte: startOfWeek }
        });

        // 3. เตรียมโครงสร้างสำหรับสรุปผล
        const summary = {
            meat: 0,
            veg: 0,
            totalRevenue: 0,
            startDate: startOfWeek.toISOString().split('T')[0],
            endDate: new Date().toISOString().split('T')[0],
        };

        // 4. ประมวลผลและจำแนกยอดขาย
        for (const order of orders) {
            let orderMeatTotal = 0;
            let orderVegTotal = 0;

            for (const item of order.orderDetails) {
                const itemName = item.name.toLowerCase();
                const isMeat = itemName.includes('เนื้อ') || itemName.includes('ไก่') || itemName.includes('หมู');
                
                if (isMeat) {
                    orderMeatTotal += item.totalPrice;
                } else {
                    orderVegTotal += item.totalPrice;
                }
            }
            
            summary.meat += orderMeatTotal;
            summary.veg += orderVegTotal;
            summary.totalRevenue += order.totalAmount; 
        }

        res.status(200).json(summary);
    } catch (error) {
        console.error('Error calculating weekly summary:', error);
        res.status(500).json({ message: 'Failed to calculate weekly summary', error: error.message });
    }
});


module.exports = router;