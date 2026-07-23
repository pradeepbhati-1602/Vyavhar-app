const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const generateInvoicePDF = (bill, customer, product, settings, filePath) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 40 });
      const writeStream = fs.createWriteStream(filePath);
      doc.pipe(writeStream);

      // Gold & Charcoal Colors
      const primaryColor = '#1A1D24'; // Dark Charcoal
      const accentColor = '#D4AF37';  // Gold
      const textColor = '#333333';
      const lightBg = '#F3F4F6';

      // Header Banner
      doc.rect(0, 0, 595.28, 120).fill(primaryColor);
      
      // Store Logo & Name
      doc.fillColor(accentColor).font('Helvetica-Bold').fontSize(26).text(settings.store_name || 'EYEVENGERS OPTICAL', 40, 30);
      doc.fillColor('#FFFFFF').font('Helvetica').fontSize(10).text('PREMIUM EYEWEAR & EYE CLINIC', 40, 60);
      doc.text(`GST: ${settings.gst_number || '27EYEVEN1001A1Z0'}`, 40, 75);
      doc.text(`Mob: ${settings.store_mobile || '9876543210'}`, 40, 90);

      // Invoice metadata
      doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(18).text('INVOICE', 420, 30, { align: 'right', width: 135 });
      doc.fontSize(10).font('Helvetica').text(`Invoice #: ${bill.bill_id}`, 420, 55, { align: 'right', width: 135 });
      doc.text(`Date: ${new Date(bill.created_at || Date.now()).toLocaleDateString()}`, 420, 70, { align: 'right', width: 135 });
      const statusLabel = (bill.due_amount > 0) ? 'PARTIAL/DUE' : 'PAID';
      doc.fillColor(accentColor).font('Helvetica-Bold').text(`Status: ${statusLabel}`, 420, 85, { align: 'right', width: 135 });

      // Customer Info
      doc.fillColor(primaryColor).font('Helvetica-Bold').fontSize(12).text('BILL TO:', 40, 140);
      doc.fillColor(textColor).font('Helvetica').fontSize(11);
      doc.text(`Customer Name : ${customer.name}`, 40, 160);
      doc.text(`Mobile Number  : ${customer.mobile}`, 40, 175);
      if (customer.address) doc.text(`Address        : ${customer.address}`, 40, 190);
      if (bill.referral_code) doc.text(`Referral Code  : ${bill.referral_code}`, 40, 205);

      // Horizontal Divider
      doc.moveTo(40, 225).lineTo(555, 225).strokeColor('#E5E7EB').lineWidth(1).stroke();

      // Power Grid if available
      let startY = 240;
      if (bill.power_details) {
        let powers = {};
        try {
          powers = typeof bill.power_details === 'string' ? JSON.parse(bill.power_details) : bill.power_details;
        } catch(e) {}

        if (Object.keys(powers).length > 0) {
          doc.fillColor(primaryColor).font('Helvetica-Bold').fontSize(12).text('PRESCRIPTION DETAILS', 40, startY);
          startY += 20;

          // Table Header
          doc.rect(40, startY, 515, 20).fill(primaryColor);
          doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(9);
          doc.text('EYE', 45, startY + 5);
          doc.text('SPH', 100, startY + 5);
          doc.text('CYL', 160, startY + 5);
          doc.text('AXIS', 220, startY + 5);
          doc.text('ADD', 280, startY + 5);
          doc.text('PD', 340, startY + 5);
          startY += 20;

          // RE Row
          doc.fillColor(textColor).font('Helvetica').fontSize(10);
          doc.text('R.E. (Right)', 45, startY + 5);
          doc.text(powers.re_sph || '0.00', 100, startY + 5);
          doc.text(powers.re_cyl || '0.00', 160, startY + 5);
          doc.text(powers.re_axis || '-', 220, startY + 5);
          doc.text(powers.add || '-', 280, startY + 5);
          doc.text(powers.pd || '-', 340, startY + 5);
          
          doc.moveTo(40, startY + 20).lineTo(555, startY + 20).strokeColor('#F3F4F6').stroke();
          startY += 20;

          // LE Row
          doc.text('L.E. (Left)', 45, startY + 5);
          doc.text(powers.le_sph || '0.00', 100, startY + 5);
          doc.text(powers.le_cyl || '0.00', 160, startY + 5);
          doc.text(powers.le_axis || '-', 220, startY + 5);
          doc.text(powers.add || '-', 280, startY + 5);
          doc.text(powers.pd || '-', 340, startY + 5);

          doc.moveTo(40, startY + 20).lineTo(555, startY + 20).strokeColor('#E5E7EB').stroke();
          startY += 30;
        }
      }

      // Items Table
      doc.fillColor(primaryColor).font('Helvetica-Bold').fontSize(12).text('PURCHASE DETAILS', 40, startY);
      startY += 20;

      // Table Header
      doc.rect(40, startY, 515, 20).fill(primaryColor);
      doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(10);
      doc.text('Items Description', 50, startY + 5);
      doc.text('Brand / Details', 250, startY + 5);
      doc.text('Rate', 420, startY + 5, { width: 60, align: 'right' });
      doc.text('Total', 485, startY + 5, { width: 60, align: 'right' });
      
      startY += 20;

      // Product item row
      doc.fillColor(textColor).font('Helvetica').fontSize(10);
      if (product) {
        doc.text(`${product.category} — ${product.frame_name}`, 50, startY + 5);
        doc.text(`Col: ${product.frame_color || '-'}, Size: ${product.size || '-'}`, 250, startY + 5);
        doc.text(`₹${parseFloat(product.selling_price).toFixed(2)}`, 420, startY + 5, { width: 60, align: 'right' });
        doc.text(`₹${parseFloat(product.selling_price).toFixed(2)}`, 485, startY + 5, { width: 60, align: 'right' });
      } else {
        // Fallback or Sunglasses Walk-in Description
        doc.text('Optical Frame / Accessories', 50, startY + 5);
        doc.text('Standard Package', 250, startY + 5);
        doc.text(`₹${parseFloat(bill.subtotal).toFixed(2)}`, 420, startY + 5, { width: 60, align: 'right' });
        doc.text(`₹${parseFloat(bill.subtotal).toFixed(2)}`, 485, startY + 5, { width: 60, align: 'right' });
      }

      // Lens Row if present
      let lens = {};
      try {
        lens = typeof bill.lens_details === 'string' ? JSON.parse(bill.lens_details) : bill.lens_details;
      } catch(e) {}

      if (lens && lens.type) {
        startY += 20;
        doc.text(`Lens: ${lens.type}`, 50, startY + 5);
        doc.text(`${lens.coating || 'Standard Coating'}`, 250, startY + 5);
        doc.text(`₹${parseFloat(lens.price || 0).toFixed(2)}`, 420, startY + 5, { width: 60, align: 'right' });
        doc.text(`₹${parseFloat(lens.price || 0).toFixed(2)}`, 485, startY + 5, { width: 60, align: 'right' });
      }

      startY += 25;
      doc.moveTo(40, startY).lineTo(555, startY).strokeColor('#E5E7EB').stroke();
      startY += 10;

      // Fix Bug 4: Avoid PDF truncation for long invoices
      if (startY > 600) {
        doc.addPage();
        startY = 60;
      }

      // Price breakdown
      const alignXLabel = 360;
      const alignXVal = 470;
      const spacingY = 18;

      doc.font('Helvetica').fontSize(10);
      
      doc.text('Subtotal:', alignXLabel, startY);
      doc.text(`₹${parseFloat(bill.subtotal).toFixed(2)}`, alignXVal, startY, { width: 75, align: 'right' });
      startY += spacingY;

      if (bill.discount > 0) {
        doc.text('Discount:', alignXLabel, startY);
        doc.text(`- ₹${parseFloat(bill.discount).toFixed(2)}`, alignXVal, startY, { width: 75, align: 'right' });
        startY += spacingY;
      }

      if (bill.cashback_used > 0) {
        doc.text('Cashback Used:', alignXLabel, startY);
        doc.text(`- ₹${parseFloat(bill.cashback_used).toFixed(2)}`, alignXVal, startY, { width: 75, align: 'right' });
        startY += spacingY;
      }

      doc.font('Helvetica-Bold').fontSize(11);
      doc.text('Grand Total:', alignXLabel, startY);
      doc.text(`₹${parseFloat(bill.total_amount).toFixed(2)}`, alignXVal, startY, { width: 75, align: 'right' });
      startY += spacingY;

      doc.font('Helvetica').fontSize(10);
      doc.text('Advance Paid:', alignXLabel, startY);
      doc.text(`₹${parseFloat(bill.advance_paid).toFixed(2)}`, alignXVal, startY, { width: 75, align: 'right' });
      startY += spacingY;

      doc.font('Helvetica-Bold').fillColor(bill.due_amount > 0 ? '#DC2626' : '#059669');
      doc.text('Balance Due:', alignXLabel, startY);
      doc.text(`₹${parseFloat(bill.due_amount).toFixed(2)}`, alignXVal, startY, { width: 75, align: 'right' });

      // QR Code Box Placeholder / Payment Instruction
      doc.fillColor(primaryColor);
      doc.rect(40, startY - 60, 180, 75).strokeColor('#E5E7EB').stroke();
      doc.fontSize(9).font('Helvetica-Bold').text('Scan to Pay / Store UPI', 50, startY - 50);
      doc.font('Helvetica').fontSize(8).text('Pay via GooglePay/PhonePe/UPI', 50, startY - 35);
      doc.font('Helvetica-Bold').fillColor(accentColor).fontSize(10).text(settings.store_mobile + '@upi', 50, startY - 20);

      // Terms & Conditions Footer at bottom
      const footerY = 750;
      doc.moveTo(40, footerY - 10).lineTo(555, footerY - 10).strokeColor('#E5E7EB').stroke();
      doc.fillColor('#6B7280').font('Helvetica').fontSize(8);
      doc.text('Terms & Conditions:', 40, footerY);
      doc.text('1. Goods once sold will not be taken back or exchanged.', 40, footerY + 10);
      doc.text('2. Please check your prescription and lenses carefully before leaving the store.', 40, footerY + 20);
      doc.text('3. All disputes are subject to local jurisdiction only.', 40, footerY + 30);
      
      doc.font('Helvetica-Bold').fillColor(primaryColor).text('THANK YOU FOR YOUR PATRONAGE!', 400, footerY + 15, { width: 155, align: 'right' });

      doc.end();
      writeStream.on('finish', () => resolve(true));
      writeStream.on('error', (err) => reject(err));
    } catch (e) {
      reject(e);
    }
  });
};

const generatePrescriptionPDF = (test, customer, settings, filePath) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 40 });
      const writeStream = fs.createWriteStream(filePath);
      doc.pipe(writeStream);

      const primaryColor = '#1A1D24';
      const accentColor = '#D4AF37';
      const textColor = '#333333';

      // Header Banner
      doc.rect(0, 0, 595.28, 110).fill(primaryColor);
      
      doc.fillColor(accentColor).font('Helvetica-Bold').fontSize(24).text(settings.store_name || 'EYEVENGERS OPTICAL', 40, 25);
      doc.fillColor('#FFFFFF').font('Helvetica').fontSize(10).text('CLINICAL EYE TESTING & PRESCRIPTION', 40, 55);
      doc.text(`Address: ${settings.store_address || 'Metropolis'}`, 40, 70);
      doc.text(`Tel: ${settings.store_mobile || '9876543210'}`, 40, 85);

      doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(16).text('PRESCRIPTION', 400, 25, { align: 'right', width: 155 });
      doc.fontSize(10).font('Helvetica').text(`ID: ${test.eyetest_id}`, 400, 50, { align: 'right', width: 155 });
      doc.text(`Date: ${new Date(test.created_at || Date.now()).toLocaleDateString()}`, 400, 65, { align: 'right', width: 155 });

      // Patient Details
      doc.fillColor(primaryColor).font('Helvetica-Bold').fontSize(12).text('PATIENT PROFILE:', 40, 130);
      doc.fillColor(textColor).font('Helvetica').fontSize(11);
      doc.text(`Name    : ${test.patient_name}`, 40, 150);
      doc.text(`Mobile  : ${test.mobile}`, 40, 165);
      doc.text(`Age     : ${test.age || '-'} Years`, 40, 180);
      doc.text(`Vision  : ${test.vision_category || 'Distance / Reading'}`, 40, 195);

      doc.moveTo(40, 215).lineTo(555, 215).strokeColor('#E5E7EB').stroke();

      // Power Grid
      let startY = 230;
      doc.fillColor(primaryColor).font('Helvetica-Bold').fontSize(12).text('REFRACTION / POWER DETAILS', 40, startY);
      startY += 20;

      // Table Header
      doc.rect(40, startY, 515, 20).fill(primaryColor);
      doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(9);
      doc.text('EYE', 45, startY + 5);
      doc.text('SPH', 120, startY + 5);
      doc.text('CYL', 200, startY + 5);
      doc.text('AXIS', 280, startY + 5);
      doc.text('ADD', 360, startY + 5);
      doc.text('PD', 440, startY + 5);
      startY += 20;

      // RE Row
      doc.fillColor(textColor).font('Helvetica').fontSize(10);
      doc.text('Right Eye (OD)', 45, startY + 5);
      doc.text(test.re_sph !== null ? parseFloat(test.re_sph).toFixed(2) : '0.00', 120, startY + 5);
      doc.text(test.re_cyl !== null ? parseFloat(test.re_cyl).toFixed(2) : '0.00', 200, startY + 5);
      doc.text(test.re_axis !== null ? test.re_axis : '-', 280, startY + 5);
      doc.text(test.add_power !== null ? parseFloat(test.add_power).toFixed(2) : '-', 360, startY + 5);
      doc.text(test.pd !== null ? parseFloat(test.pd).toFixed(2) : '-', 440, startY + 5);
      
      doc.moveTo(40, startY + 20).lineTo(555, startY + 20).strokeColor('#F3F4F6').stroke();
      startY += 20;

      // LE Row
      doc.text('Left Eye (OS)', 45, startY + 5);
      doc.text(test.le_sph !== null ? parseFloat(test.le_sph).toFixed(2) : '0.00', 120, startY + 5);
      doc.text(test.le_cyl !== null ? parseFloat(test.le_cyl).toFixed(2) : '0.00', 200, startY + 5);
      doc.text(test.le_axis !== null ? test.le_axis : '-', 280, startY + 5);
      doc.text(test.add_power !== null ? parseFloat(test.add_power).toFixed(2) : '-', 360, startY + 5);
      doc.text(test.pd !== null ? parseFloat(test.pd).toFixed(2) : '-', 440, startY + 5);

      doc.moveTo(40, startY + 20).lineTo(555, startY + 20).strokeColor('#E5E7EB').stroke();
      startY += 40;

      // Doctor Notes
      if (test.doctor_notes) {
        doc.fillColor(primaryColor).font('Helvetica-Bold').fontSize(11).text('CLINICAL NOTES / RECOMMENDATIONS', 40, startY);
        doc.fillColor(textColor).font('Helvetica').fontSize(10);
        doc.text(test.doctor_notes, 40, startY + 18, { width: 515 });
        startY += 80;
      }

      // Sign-off
      const signY = 650;
      doc.moveTo(350, signY).lineTo(530, signY).strokeColor('#E5E7EB').stroke();
      doc.fillColor(primaryColor).font('Helvetica-Bold').fontSize(10).text('Authorized Optometrist Signature', 350, signY + 5, { align: 'center', width: 180 });

      // Footer
      const footerY = 750;
      doc.moveTo(40, footerY - 10).lineTo(555, footerY - 10).strokeColor('#E5E7EB').stroke();
      doc.fillColor('#6B7280').font('Helvetica').fontSize(8);
      doc.text('Note: This prescription is valid for 6 months from the date of issue.', 40, footerY);
      doc.text('We recommend an annual eye check-up for consistent visual health.', 40, footerY + 10);
      
      doc.end();
      writeStream.on('finish', () => resolve(true));
      writeStream.on('error', (err) => reject(err));
    } catch (e) {
      reject(e);
    }
  });
};

module.exports = {
  generateInvoicePDF,
  generatePrescriptionPDF
};
