const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
    // รหัสคำสั่งซื้อแบบสั้น
    // **การแก้ไข:** ลบ required: true ออก
    orderId: {
        type: String,
        // required: true, <--- บรรทัดนี้ถูกนำออกไปแล้ว
        unique: true, // ยังคงตรวจสอบความซ้ำ
        uppercase: true, 
    },
    
    // ข้อมูลลูกค้า/ร้าน
    customerNote: {
        type: String,
        required: true,
        trim: true, 
    },
    pickupTime: {
        type: String, 
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
        enum: ['Pending', 'Processing', 'Ready', 'Completed', 'Cancelled'],
        default: 'Pending',
    }
}, {
    timestamps: true 
});

// ***************************************
// Middleware: สร้างรหัส Order ID สั้นก่อนบันทึก (Pre-save Hook)
// ***************************************
orderSchema.pre('save', async function(next) {
    // เงื่อนไข: ตรวจสอบเฉพาะเมื่อเป็นการสร้างเอกสารใหม่ และ orderId ยังไม่มีค่า
    // การนำ required: true ออก ทำให้ Hook นี้มีโอกาสทำงาน
    if (this.isNew && !this.orderId) { 
        // สร้างรหัส 8 ตัวอักษร จากตัวเลข/ตัวอักษร A-Z, 0-9 
        const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        let uniqueId;
        let isUnique = false;

        while (!isUnique) {
            uniqueId = '';
            for (let i = 0; i < 8; i++) {
                uniqueId += chars[Math.floor(Math.random() * chars.length)];
            }
            // ตรวจสอบความซ้ำในฐานข้อมูล 
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