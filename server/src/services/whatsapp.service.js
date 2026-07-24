exports.sendInvoice = async (mobile, customerName, shopName, total, pdfUrl) => {
  const message = `Dear ${customerName}, thanks for visiting ${shopName}. Your bill for ₹${total} is attached. View invoice: ${pdfUrl}`;
  // TODO: Replace with actual WhatsApp Business API provider logic (Twilio, Meta, Wati)
  console.log('\n=============================================');
  console.log(`[WHATSAPP MOCK - INVOICE] To: ${mobile}`);
  console.log(message);
  console.log('=============================================\n');
  return true;
};

exports.sendHandoverGreeting = async (mobile, customerName, shopName) => {
  const message = `Dear ${customerName}, your eyewear from ${shopName} is ready and has been handed over. Enjoy your new look!`;
  // TODO: Replace with actual API logic
  console.log('\n=============================================');
  console.log(`[WHATSAPP MOCK - HANDOVER] To: ${mobile}`);
  console.log(message);
  console.log('=============================================\n');
  return true;
};

exports.sendBirthdayWish = async (mobile, customerName, shopName) => {
  const message = `Happy Birthday ${customerName}! ${shopName} wishes you a fantastic year. Here is a special 20% off code: BDAY20.`;
  // TODO: Replace with actual API logic
  console.log('\n=============================================');
  console.log(`[WHATSAPP MOCK - BIRTHDAY] To: ${mobile}`);
  console.log(message);
  console.log('=============================================\n');
  return true;
};
