const mongoose = require('mongoose');

// **Note:** การใช้ async/await ใน pre('save') hook เป็นวิธีที่ถูกต้องและทันสมัย

const orderSchema = new mongoose.Schema({
    // รหัสคำสั่งซื้อแบบสั้น (จะถูกสร้างโดย Pre-save Hook)
    orderId: {
        type: String,
        unique: true,
        uppercase: true,
        // *** ปรับปรุง: ไม่กำหนด required ใน Schema เพื่อให้ Hook จัดการได้เต็มที่ ***
    },
    
    // ข้อมูลลูกค้า/ร้าน
    customerNote: {
        type: String,
        required: true,
        trim: true,
    },
    pickupTime: {
        type: String, // เก็บเป็น String (HH:MM)
        required: true,
    },
    
    // รายละเอียดสินค้าที่สั่ง
    orderDetails: [{
        // id: { type: Number, required: true }, // ไม่จำเป็นต้องใช้ id นี้หากใช้ _id ของ MongoDB
        name: { type: String, required: true },
        // **ปรับปรุง: เพิ่ม type เพื่อใช้ในการคำนวณ Summary แยกประเภท (เนื้อ/ผัก)**
        type: { type: String, enum: ['Meat', 'Veg'], required: true }, 
        quantity: { type: Number, required: true, min: 1 },
        pricePerUnit: { type: Number, required: true, min: 0 },
        // totalPrice: { type: Number, required: true, min: 0 }, // สามารถคำนวณได้จาก Frontend หรือ Pre-save Hook แทน
    }],
    
    // สรุปยอดรวม
    totalAmount: {
        type: Number,
        required: true,
        min: 0,
    },
    
    // สถานะคำสั่งซื้อ (ตามที่ต้องการ: เหลือ 2 สถานะหลัก + ยกเลิก)
    status: {
        type: String,
        // *** แก้ไข: เหลือแค่ Processing, Completed, Cancelled ***
        enum: ['Processing', 'Completed', 'Cancelled'],
        default: 'Processing', // *** แก้ไข: Default เป็น 'Processing' ***
    }
}, {
    timestamps: true // เพิ่ม createdAt และ updatedAt อัตโนมัติ
});

// ***************************************
// Middleware: สร้างรหัส Order ID สั้นก่อนบันทึก (Pre-save Hook)
// ***************************************
orderSchema.pre('save', async function() { 
    // เงื่อนไข: ตรวจสอบเฉพาะเมื่อเป็นการสร้างเอกสารใหม่ และ orderId ยังไม่มีค่า
    if (this.isNew && !this.orderId) { 
        const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        let uniqueId;
        let isUnique = false;
        
        // **ปรับปรุง:** จำกัดจำนวนครั้งที่พยายามสร้าง ID เพื่อป้องกัน Loop ไม่รู้จบ (Safety measure)
        let maxAttempts = 5; 
        let attempts = 0;

        while (!isUnique && attempts < maxAttempts) {
            uniqueId = '';
            for (let i = 0; i < 8; i++) {
                uniqueId += chars[Math.floor(Math.random() * chars.length)];
            }
            
            // ตรวจสอบความซ้ำในฐานข้อมูล (ใช้ this.constructor แทน Order)
            const existingOrder = await this.constructor.findOne({ orderId: uniqueId });
            
            if (!existingOrder) {
                isUnique = true;
            }
            attempts++;
        }

        if (isUnique) {
            this.orderId = uniqueId;
        } else {
            // **การจัดการข้อผิดพลาด:** ถ้าสร้าง ID ไม่ได้หลังจากหลายครั้ง ให้โยน Error
            throw new Error("Could not generate a unique Order ID after " + maxAttempts + " attempts.");
        }
    }
});

module.exports = mongoose.model('Order', orderSchema);