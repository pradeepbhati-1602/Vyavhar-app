const PDFDocument = require('pdfkit');

exports.generateInvoicePDF = async (bill, tenant) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50 });
      const buffers = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        const pdfData = Buffer.concat(buffers);
        resolve(pdfData);
      });

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
      const subtotal = Number(bill.total_amount || 0) + Number(bill.cashback_used || 0);
      let yPosition = doc.y + 10;
      doc.text('Optical Products / Services', 50, yPosition);
      doc.text(`Rs. ${subtotal.toFixed(2)}`, 450, yPosition, { width: 90, align: 'right' });
      doc.moveDown(2);

      // Financials
      doc.moveTo(350, doc.y).lineTo(550, doc.y).stroke();
      doc.moveDown();
      
      const finX = 350;
      doc.text('Subtotal:', finX, doc.y);
      doc.text(subtotal.toFixed(2), 450, doc.y, { width: 90, align: 'right' });
      doc.moveDown(0.5);

      if (bill.cashback_used > 0) {
        doc.text('Cashback Used:', finX, doc.y);
        doc.text(`- ${Number(bill.cashback_used).toFixed(2)}`, 450, doc.y, { width: 90, align: 'right' });
        doc.moveDown(0.5);
      }

      doc.font('Helvetica-Bold');
      doc.text('Total Amount:', finX, doc.y);
      doc.text(Number(bill.total_amount || 0).toFixed(2), 450, doc.y, { width: 90, align: 'right' });
      doc.font('Helvetica');
      doc.moveDown(0.5);

      doc.text('Advance Paid:', finX, doc.y);
      doc.text(Number(bill.advance_paid || 0).toFixed(2), 450, doc.y, { width: 90, align: 'right' });
      doc.moveDown(0.5);

      doc.font('Helvetica-Bold');
      doc.text('Due Amount:', finX, doc.y);
      doc.text(Number(bill.due_amount || 0).toFixed(2), 450, doc.y, { width: 90, align: 'right' });
      doc.moveDown(2);

      // Power Details
      if (bill.bill_type === 'REGULAR' && bill.power_details && Object.keys(bill.power_details).length > 0) {
        doc.font('Helvetica-Bold').text('Eye Power Details', 50, doc.y);
        doc.font('Helvetica').fontSize(10);
        doc.text(JSON.stringify(bill.power_details, null, 2), 50, doc.y + 10);
      }

      doc.end();

    } catch (err) {
      reject(err);
    }
  });
};

exports.generatePrescriptionPDF = async (test, tenant) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50 });
      const buffers = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        const pdfData = Buffer.concat(buffers);
        resolve(pdfData);
      });

      // Header
      doc.fontSize(20).text(tenant.business_name, { align: 'center' });
      doc.fontSize(10).text(`Address: ${tenant.address || 'N/A'}`, { align: 'center' });
      doc.text(`Contact: ${tenant.contact_phone || 'N/A'}`, { align: 'center' });
      doc.moveDown();
      doc.fontSize(16).text('DIAGNOSTIC PRESCRIPTION', { align: 'center', underline: true });
      doc.moveDown();

      // Test Info
      doc.fontSize(12).text(`Date: ${new Date(test.created_at).toLocaleDateString()}`);
      doc.text(`Patient Name: ${test.patient_name}`);
      doc.text(`Mobile: ${test.mobile}`);
      doc.moveDown();

      // Refraction Details
      doc.font('Helvetica-Bold').text('Refraction Details', 50, doc.y);
      doc.font('Helvetica').fontSize(10);
      
      const details = {
        RightEye: { SPH: test.re_sph, CYL: test.re_cyl, AXIS: test.re_axis },
        LeftEye: { SPH: test.le_sph, CYL: test.le_cyl, AXIS: test.le_axis },
        AddPower: test.add_power,
        PD: test.pd,
        Vision: test.vision_category
      };
      
      doc.text(JSON.stringify(details, null, 2), 50, doc.y + 10);
      doc.moveDown(2);

      if (test.doctor_notes) {
        doc.font('Helvetica-Bold').text('Doctor Notes:', 50, doc.y);
        doc.font('Helvetica').text(test.doctor_notes, 50, doc.y + 10);
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
};
