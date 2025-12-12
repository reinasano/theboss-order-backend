// models/Order.js
const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
    // รหัสคำสั่งซื้อแบบสั้น (เช่น 1A2B3C4D) เพื่อให้ลูกค้าตรวจสอบได้ง่าย
    orderId: {
        type: String,
        required: true,
        unique: true, // ห้ามซ้ำ
        uppercase: true, // เก็บเป็นตัวพิมพ์ใหญ่
    },
    
    // ข้อมูลลูกค้า/ร้าน
    customerNote: {
        type: String,
        required: true,
        trim: true, // ตัดช่องว่างหน้า-หลัง
    },
    pickupTime: {
        type: String, // เก็บเป็น String (HH:MM)
        required: true,
    },
    
    // รายละเอียดสินค้าที่สั่ง
    orderDetails: [{
        id: { type: Number, required: true },
        name: { type: String, required: true },
        quantity: { type: Number, required: true, min: 1 },
        pricePerUnit: { type: Number, required: true, min: 0 },
        totalPrice: { type: Number, required: true, min: 0 },
    }],
    
    // สรุปยอดรวม
    totalAmount: {
        type: Number,
        required: true,
        min: 0,
    },
    
    // สถานะคำสั่งซื้อ
    status: {
        type: String,
        // กำหนดสถานะที่ยอมรับได้
        enum: ['Pending', 'Processing', 'Ready', 'Completed', 'Cancelled'],
        default: 'Pending',
    }
}, {
    // สำคัญ: Mongoose จะเพิ่มฟิลด์ createdAt และ updatedAt ให้โดยอัตโนมัติ 
    // เราจะใช้ createdAt ในการกรองวันที่
    timestamps: true 
});

// ***************************************
// Middleware: สร้างรหัส Order ID สั้นก่อนบันทึก (Pre-save Hook)
// ***************************************
orderSchema.pre('save', async function(next) {
    if (this.isNew) {
        // สร้างรหัส 8 ตัวอักษร จากตัวเลข/ตัวอักษร A-Z, 0-9 
        const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        let uniqueId;
        let isUnique = false;

        while (!isUnique) {
            uniqueId = '';
            for (let i = 0; i < 8; i++) {
                uniqueId += chars[Math.floor(Math.random() * chars.length)];
            }
            // ตรวจสอบความซ้ำในฐานข้อมูล (Self-check)
            const existingOrder = await this.constructor.findOne({ orderId: uniqueId });
            if (!existingOrder) {
                isUnique = true;
            }
        }
        this.orderId = uniqueId;
    }
    next();
});

module.exports = mongoose.model('Order', orderSchema);