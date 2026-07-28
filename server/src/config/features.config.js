const FEATURE_CATEGORIES = [
  {
    category: "Dashboard Widgets",
    features: [
      { key: "due_amount_card", name: "Due Amount Card", tooltip: "Shows total outstanding dues on the dashboard.", dependencies: ["billing"] },
      { key: "birthday_customers_card", name: "Birthday Customers Card", tooltip: "Shows today's customer birthdays.", dependencies: ["customer_management"] },
      { key: "pending_delivery_card", name: "Pending Delivery Card", tooltip: "Shows pending handovers on dashboard.", dependencies: ["billing"] },
      { key: "low_stock_alert", name: "Low Stock Alert", tooltip: "Shows products below reorder point.", dependencies: ["inventory"] },
      { key: "today_sales", name: "Today's Sales", tooltip: "Shows total sales for today.", dependencies: ["billing"] },
      { key: "monthly_sales", name: "Monthly Sales", tooltip: "Shows total sales for the current month.", dependencies: ["billing"] },
      { key: "total_customers", name: "Total Customers", tooltip: "Shows total registered customers.", dependencies: ["customer_management"] },
      { key: "recent_activity", name: "Recent Activity", tooltip: "Shows the latest generated invoices.", dependencies: ["billing"] },
      { key: "pending_payments", name: "Pending Payments", tooltip: "Shows invoices with pending balances.", dependencies: ["billing"] },
      { key: "top_selling_products", name: "Top Selling Products", tooltip: "Shows the most sold items.", dependencies: ["billing", "inventory"] }
    ]
  },
  {
    category: "Core Modules",
    features: [
      { key: "customer_management", name: "Customer Management", tooltip: "Manage customers and their histories.", dependencies: [] },
      { key: "billing", name: "Billing", tooltip: "Core billing system for creating invoices.", dependencies: ["customer_management", "inventory"] },
      { key: "sunglasses_billing", name: "Sunglasses Billing", tooltip: "Quick walk-in billing for non-prescription items.", dependencies: ["customer_management", "inventory"] },
      { key: "eye_test", name: "Eye Test", tooltip: "Record prescriptions and eye test details.", dependencies: ["customer_management"] },
      { key: "repair_orders", name: "Repair Orders", tooltip: "Manage frame repair and service jobs.", dependencies: ["customer_management"] },
      { key: "product_management", name: "Product Management", tooltip: "Add and edit products and catalog.", dependencies: [] },
      { key: "inventory", name: "Inventory", tooltip: "Track and adjust stock levels.", dependencies: ["product_management"] },
      { key: "referral_system", name: "Referral & Cashback", tooltip: "Allow customers to refer others and earn rewards.", dependencies: ["billing"] },
      { key: "membership_system", name: "Membership System", tooltip: "Create subscription plans and member discounts.", dependencies: ["billing"] },
      { key: "reports", name: "Reports & Analytics", tooltip: "View detailed financial and stock reports.", dependencies: ["billing", "inventory"] },
      { key: "multi_store", name: "Multi Store", tooltip: "Manage multiple branches under one tenant.", dependencies: [] },
      { key: "expense_management", name: "Expense Management", tooltip: "Track operational expenses (Future Module).", dependencies: [] },
      { key: "purchase_management", name: "Purchase Management", tooltip: "Manage vendor purchases (Future Module).", dependencies: ["inventory"] },
      { key: "notifications", name: "Notifications", tooltip: "In-app alerts for low stock, renewals, etc.", dependencies: [] },
      { key: "appointment_booking", name: "Appointment Booking", tooltip: "Schedule eye tests (Future Module).", dependencies: ["customer_management"] },
      { key: "sms", name: "SMS", tooltip: "Send automated SMS notifications.", dependencies: ["customer_management"] },
      { key: "whatsapp", name: "WhatsApp", tooltip: "Send automated WhatsApp notifications.", dependencies: ["customer_management"] },
      { key: "invoice_generator", name: "Invoice Generator", tooltip: "Generate PDF invoices.", dependencies: ["billing"] },
      { key: "barcode_printing", name: "Barcode Printing", tooltip: "Print barcode labels (Future Module).", dependencies: ["inventory"] }
    ]
  },
  {
    category: "Access Management",
    features: [
      { key: "employee_accounts", name: "Employee Accounts", tooltip: "Create logins for your staff.", dependencies: [] },
      { key: "employee_roles", name: "Employee Roles", tooltip: "Assign roles to staff members.", dependencies: ["employee_accounts"] },
      { key: "permissions", name: "Permissions", tooltip: "Granular access control.", dependencies: ["employee_accounts"] },
      { key: "attendance", name: "Attendance", tooltip: "Track staff attendance (Future Module).", dependencies: ["employee_accounts"] },
      { key: "activity_logs", name: "Activity Logs", tooltip: "Track user actions and audit trails.", dependencies: ["employee_accounts"] }
    ]
  },
  {
    category: "Marketing",
    features: [
      { key: "referral_campaigns", name: "Referral Campaigns", tooltip: "Run referral marketing.", dependencies: ["referral_system"] },
      { key: "cashback", name: "Cashback", tooltip: "Reward customers with wallet cashback.", dependencies: ["billing"] },
      { key: "coupons", name: "Coupons", tooltip: "Promo code engine (Future Module).", dependencies: ["billing"] },
      { key: "membership_offers", name: "Membership Offers", tooltip: "Special promotions for members.", dependencies: ["membership_system"] },
      { key: "birthday_offers", name: "Birthday Offers", tooltip: "Send automated birthday discounts.", dependencies: ["customer_management"] },
      { key: "bulk_messaging", name: "Bulk Messaging", tooltip: "Send promotional blasts (Future Module).", dependencies: ["customer_management"] }
    ]
  },
  {
    category: "Settings",
    features: [
      { key: "shop_information", name: "Shop Information", tooltip: "Configure basic shop details.", dependencies: [] },
      { key: "invoice_settings", name: "Invoice Settings", tooltip: "Configure invoice formats.", dependencies: ["billing"] },
      { key: "message_templates", name: "Message Templates", tooltip: "Customize automated messages.", dependencies: [] },
      { key: "membership_plans", name: "Membership Plans", tooltip: "Define membership pricing tiers.", dependencies: ["membership_system"] },
      { key: "referral_configuration", name: "Referral Configuration", tooltip: "Define referral rewards.", dependencies: ["referral_system"] },
      { key: "taxes", name: "Taxes", tooltip: "Configure tax rates.", dependencies: ["billing"] },
      { key: "branding", name: "Branding", tooltip: "Customize app branding.", dependencies: [] },
      { key: "logo", name: "Logo", tooltip: "Upload custom logos.", dependencies: ["branding"] },
      { key: "themes", name: "Themes", tooltip: "Change UI color themes.", dependencies: ["branding"] }
    ]
  }
];

module.exports = { FEATURE_CATEGORIES };
