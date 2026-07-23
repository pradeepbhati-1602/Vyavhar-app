const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

exports.generateInvoicePDF = async (bill, tenant) => {
  return new Promise((resolve, reject) => {
    try {
      const fileName = `${bill.invoice_number}.pdf`;
      const filePath = path.join(__dirname, '..', '..', 'uploads', fileName);
      const doc = new PDFDocument({ margin: 50 });

      const writeStream = fs.createWriteStream(filePath);
      doc.pipe(writeStream);

      // Header
      doc.fontSize(20).text(tenant.business_name, { align: 'center' });
      doc.fontSize(10).text(`Address: ${tenant.address || 'N/A'}`, { align: 'center' });
      doc.text(`Contact: ${tenant.contact_phone || 'N/A'}`, { align: 'center' });
      doc.moveDown();
      doc.fontSize(16).text('TAX INVOICE', { align: 'center', underline: true });
      doc.moveDown();

      // Bill Info
      doc.fontSize(12).text(`Invoice Number: ${bill.invoice_number}`);
      doc.text(`Date: ${new Date(bill.created_at).toLocaleDateString()}`);
      doc.moveDown();

      // Customer Info
      doc.text(`Customer Name: ${bill.customer.name}`);
      doc.text(`Mobile: ${bill.customer.mobile}`);
      doc.moveDown();

      // Itemized Table Header
      const tableTop = doc.y;
      doc.font('Helvetica-Bold');
      doc.text('Item', 50, tableTop);
      doc.text('Total', 450, tableTop, { width: 90, align: 'right' });
      doc.moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).stroke();
      doc.font('Helvetica');
      doc.moveDown();

      // Items (Since we don't store line items explicitly in this mock schema, 
      // we just show the consolidated summary based on financials)
      let yPosition = doc.y + 10;
      doc.text('Optical Products / Services', 50, yPosition);
      doc.text(`Rs. ${bill.subtotal.toFixed(2)}`, 450, yPosition, { width: 90, align: 'right' });
      doc.moveDown(2);

      // Financials
      doc.moveTo(350, doc.y).lineTo(550, doc.y).stroke();
      doc.moveDown();
      
      const finX = 350;
      doc.text('Subtotal:', finX, doc.y);
      doc.text(bill.subtotal.toFixed(2), 450, doc.y, { width: 90, align: 'right' });
      doc.moveDown(0.5);

      if (bill.discount > 0) {
        doc.text('Discount:', finX, doc.y);
        doc.text(`- ${bill.discount.toFixed(2)}`, 450, doc.y, { width: 90, align: 'right' });
        doc.moveDown(0.5);
      }

      if (bill.cashback_used > 0) {
        doc.text('Cashback Used:', finX, doc.y);
        doc.text(`- ${bill.cashback_used.toFixed(2)}`, 450, doc.y, { width: 90, align: 'right' });
        doc.moveDown(0.5);
      }

      doc.font('Helvetica-Bold');
      doc.text('Total Amount:', finX, doc.y);
      doc.text(bill.total_amount.toFixed(2), 450, doc.y, { width: 90, align: 'right' });
      doc.font('Helvetica');
      doc.moveDown(0.5);

      doc.text('Advance Paid:', finX, doc.y);
      doc.text(bill.advance_paid.toFixed(2), 450, doc.y, { width: 90, align: 'right' });
      doc.moveDown(0.5);

      doc.font('Helvetica-Bold');
      doc.text('Due Amount:', finX, doc.y);
      doc.text(bill.due_amount.toFixed(2), 450, doc.y, { width: 90, align: 'right' });
      doc.moveDown(2);

      // Power Details
      if (bill.bill_type === 'REGULAR' && Object.keys(bill.power_details).length > 0) {
        doc.font('Helvetica-Bold').text('Eye Power Details', 50, doc.y);
        doc.font('Helvetica').fontSize(10);
        doc.text(JSON.stringify(bill.power_details, null, 2), 50, doc.y + 10);
      }

      doc.end();

      writeStream.on('finish', () => {
        resolve(`/uploads/${fileName}`);
      });

      writeStream.on('error', (err) => {
        reject(err);
      });
    } catch (err) {
      reject(err);
    }
  });
};
