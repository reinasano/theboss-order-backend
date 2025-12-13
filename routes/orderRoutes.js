// routes/orderRoutes.js
const express = require('express');
const router = express.Router();
const Order = require('../models/Order'); 

// *** ตัวแปรคงที่สำหรับสถานะที่อนุญาต (ต้องตรงกับ Order.js Schema) ***
const ALLOWED_STATUSES = ['Processing', 'Completed', 'Cancelled'];

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
        // ตรวจสอบ Query Logic สำหรับ Date (ถูกต้องแล้ว)
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
// 2. POST /api/orders: สร้างคำสั่งซื้อใหม่ (ใช้ runValidators: true)
// *****************************************************************
router.post('/', async (req, res) => {
    try {
        // **ปรับปรุง:** สามารถใช้ Order.create() แทน new Order() และ .save() ได้
        const savedOrder = await Order.create(req.body); 

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
        
        // **แก้ไข/ปรับปรุง:** ตรวจสอบสถานะที่ส่งมาว่าอยู่ในสถานะที่อนุญาตหรือไม่ (ใช้ ALLOWED_STATUSES)
        if (!ALLOWED_STATUSES.includes(status)) {
            return res.status(400).json({ message: `Invalid status: ${status}. Allowed: ${ALLOWED_STATUSES.join(', ')}` });
        }

        // **ปรับปรุง:** ไม่ต้องใช้ runValidators: true เพราะการตรวจสอบ status ทำไปแล้ว แต่ถ้ามีการเพิ่ม validation อื่นก็ควรมีไว้
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
        // ใช้ 400 สำหรับ validation error จาก Mongoose (เช่น สถานะไม่อยู่ใน enum)
        res.status(400).json({ message: 'Failed to update order status', error: error.message });
    }
});


// *****************************************************************
// 5. GET /api/orders/summary/weekly: สรุปยอดขายรายสัปดาห์ (Admin Function)
// *****************************************************************
router.get('/summary/weekly', async (req, res) => {
    try {
        // 1. กำหนดช่วงเวลา (สัปดาห์ปัจจุบัน เริ่มต้นวันจันทร์) - Logic ถูกต้องแล้ว (เริ่มต้นวันจันทร์)
        const now = new Date();
        const dayOfWeek = now.getDay(); // 0=อาทิตย์, 1=จันทร์, ..., 6=เสาร์
        const diff = (dayOfWeek === 0) ? 6 : dayOfWeek - 1; // 0=อาทิตย์, -1 = จันทร์ (1-1=0) -> 6=อาทิตย์, 5=เสาร์
        
        const startOfWeek = new Date(now); // Clone Date
        startOfWeek.setDate(now.getDate() - diff); // Go to Monday
        startOfWeek.setHours(0, 0, 0, 0);

        // 2. ดึงข้อมูลคำสั่งซื้อที่ถือว่าเป็นรายรับในสัปดาห์นี้
        // **แก้ไข:** ถ้าต้องการยอดสรุปที่แน่นอน ควรสรุปเฉพาะ 'Completed' (ที่ได้รับเงินแล้ว)
        const orders = await Order.find({
            status: 'Completed', // *** แก้ไข: สรุปจาก 'Completed' เท่านั้น ***
            createdAt: { $gte: startOfWeek }
        });

        // 3. เตรียมโครงสร้างสำหรับสรุปผล
        const summary = {
            meat: 0,
            veg: 0,
            totalRevenue: 0,
            startDate: startOfWeek.toLocaleDateString('th-TH'), // **ปรับปรุง: ใช้ toLocaleDateString เพื่อแสดงผลที่อ่านง่าย**
            endDate: new Date().toLocaleDateString('th-TH'), 
        };

        // 4. ประมวลผลและจำแนกยอดขาย
        for (const order of orders) {
            let orderMeatTotal = 0;
            let orderVegTotal = 0;

            // **การแก้ไขที่สำคัญ:** ใช้ 'item.type' ที่กำหนดไว้ใน Order Schema แทนการใช้ .includes('เนื้อ')
            // การใช้ .includes('เนื้อ') อาจเกิดข้อผิดพลาดถ้าชื่อสินค้าเปลี่ยน
            for (const item of order.orderDetails) {
                const itemTotal = item.quantity * item.pricePerUnit; // คำนวณยอดรวมของสินค้า

                if (item.type === 'Meat') { // ตรวจสอบจาก field 'type' ใน Schema
                    orderMeatTotal += itemTotal;
                } else if (item.type === 'Veg') { // ตรวจสอบจาก field 'type' ใน Schema
                    orderVegTotal += itemTotal;
                }
                // ถ้ามี type อื่นที่ไม่ใช่ Meat/Veg จะถูกละเว้นจากการจำแนก
            }
            
            summary.meat += orderMeatTotal;
            summary.veg += orderVegTotal;
            // **แก้ไข:** คำนวณ totalRevenue จากยอดรวมของ Meat/Veg ที่จำแนกได้ เพื่อให้สอดคล้องกับยอดแยกประเภท
            // หรือใช้ order.totalAmount (ถ้าเชื่อถือได้) แต่การรวม Meat+Veg ปลอดภัยกว่า
            summary.totalRevenue += orderMeatTotal + orderVegTotal;
        }

        res.status(200).json(summary);
    } catch (error) {
        console.error('Error calculating weekly summary:', error);
        res.status(500).json({ message: 'Failed to calculate weekly summary', error: error.message });
    }
});


module.exports = router;