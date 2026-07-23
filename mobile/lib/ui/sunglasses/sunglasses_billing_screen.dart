import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/network/api_client.dart';
import '../theme/app_colors.dart';

class SunglassesBillingScreen extends ConsumerStatefulWidget {
  const SunglassesBillingScreen({Key? key}) : super(key: key);

  @override
  ConsumerState<SunglassesBillingScreen> createState() => _SunglassesBillingScreenState();
}

class _SunglassesBillingScreenState extends ConsumerState<SunglassesBillingScreen> {
  bool _isLoading = false;
  bool _isSaving = false;
  
  // Customer
  final _mobileCtrl = TextEditingController();
  final _nameCtrl = TextEditingController();
  final _referralCtrl = TextEditingController();
  
  // Product
  final _barcodeCtrl = TextEditingController();
  List<dynamic> _sunglasses = [];
  String? _selectedProductId;
  Map<String, dynamic>? _selectedProduct;
  
  // Pricing
  final _discountCtrl = TextEditingController();
  final _advanceCtrl = TextEditingController();
  final _cashbackCtrl = TextEditingController();

  double _availableCashback = 0;
  bool _isExistingCustomer = false;

  @override
  void initState() {
    super.initState();
    _fetchSunglasses();
    _mobileCtrl.addListener(_onMobileChanged);
    _barcodeCtrl.addListener(_onBarcodeChanged);
  }

  @override
  void dispose() {
    _mobileCtrl.dispose();
    _barcodeCtrl.dispose();
    super.dispose();
  }

  Future<void> _fetchSunglasses() async {
    setState(() => _isLoading = true);
    try {
      final dio = ref.read(apiProvider);
      dynamic res;
      try {
        res = await dio.get('/v1/products', queryParameters: {'category': 'Sunglasses'});
      } catch (e) {
        res = await dio.get('/products', queryParameters: {'category': 'Sunglasses'});
      }
      setState(() {
        _sunglasses = (res.data is Map && res.data['data'] != null) ? res.data['data'] : (res.data is List ? res.data : []);
      });
    } catch (e) {
      debugPrint('Failed to load sunglasses: $e');
    } finally {
      setState(() => _isLoading = false);
    }
  }

  void _onMobileChanged() {
    if (_mobileCtrl.text.length == 10) {
      _lookupCustomer(_mobileCtrl.text);
    } else {
      setState(() {
        _isExistingCustomer = false;
        _availableCashback = 0;
      });
    }
  }
  
  Future<void> _lookupCustomer(String mobile) async {
    try {
      final dio = ref.read(apiProvider);
      dynamic res;
      try {
        res = await dio.get('/v1/customers/lookup/$mobile');
      } catch (e) {
        res = await dio.get('/customers/lookup/$mobile');
      }
      setState(() {
        _nameCtrl.text = res.data['customer']['name'] ?? '';
        _availableCashback = double.tryParse(res.data['customer']['current_cashback']?.toString() ?? '0') ?? 0;
        _isExistingCustomer = true;
      });
    } catch (e) {
      // Not found
      setState(() {
        _isExistingCustomer = false;
        _availableCashback = 0;
      });
    }
  }
  
  void _onBarcodeChanged() {
    final code = _barcodeCtrl.text.trim();
    if (code.isNotEmpty) {
      final p = _sunglasses.firstWhere((x) => x['barcode'] == code, orElse: () => null);
      if (p != null) {
        setState(() {
          _selectedProductId = p['product_id'];
          _selectedProduct = p;
        });
      }
    }
  }

  double get _subtotal {
    return double.tryParse(_selectedProduct?['selling_price']?.toString() ?? '0') ?? 0;
  }
  
  double get _total {
    final d = double.tryParse(_discountCtrl.text) ?? 0;
    final c = double.tryParse(_cashbackCtrl.text) ?? 0;
    return (_subtotal - d - c).clamp(0, double.infinity);
  }
  
  double get _balance {
    final a = double.tryParse(_advanceCtrl.text) ?? 0;
    return (_total - a).clamp(0, double.infinity);
  }

  Future<void> _generateBill() async {
    if (_nameCtrl.text.isEmpty || _mobileCtrl.text.length != 10 || _selectedProduct == null) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Please fill mandatory fields and select a product')));
      return;
    }

    setState(() => _isSaving = true);
    try {
      final payload = {
        'mobile': _mobileCtrl.text,
        'customer_name': _nameCtrl.text,
        'referral_code': _referralCtrl.text,
        'discount': double.tryParse(_discountCtrl.text) ?? 0,
        'cashback_used': double.tryParse(_cashbackCtrl.text) ?? 0,
        'advance_paid': double.tryParse(_advanceCtrl.text) ?? 0,
        'total_amount': _total,
        'payment_status': _balance <= 0 ? 'PAID' : 'PARTIAL',
        'items': [
          {
            'product_id': _selectedProduct!['product_id'],
            'quantity': 1,
            'unit_price': _subtotal,
            'item_type': 'SUNGLASSES'
          }
        ]
      };

      final dio = ref.read(apiProvider);
      dynamic res;
      try {
        res = await dio.post('/v1/bills', data: payload);
      } catch (e) {
        res = await dio.post('/bills', data: payload);
      }

      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Bill generated successfully!')));
      
      // Reset form
      _mobileCtrl.clear();
      _nameCtrl.clear();
      _referralCtrl.clear();
      _barcodeCtrl.clear();
      _discountCtrl.clear();
      _advanceCtrl.clear();
      _cashbackCtrl.clear();
      setState(() {
        _selectedProduct = null;
        _selectedProductId = null;
      });
      
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: $e')));
    } finally {
      setState(() => _isSaving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.darkBg,
      appBar: AppBar(
        title: const Text('Sunglasses Quick Bill', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
        backgroundColor: AppColors.darkSurface,
        iconTheme: const IconThemeData(color: Colors.white),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Customer Info
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: AppColors.darkSurface.withOpacity(0.5),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: Colors.white.withOpacity(0.05)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Customer Details', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16)),
                  const SizedBox(height: 16),
                  _inputField(_mobileCtrl, 'Mobile Number', Icons.phone, keyboardType: TextInputType.phone, maxLength: 10),
                  const SizedBox(height: 12),
                  _inputField(_nameCtrl, 'Customer Name', Icons.person),
                  const SizedBox(height: 12),
                  _inputField(_referralCtrl, 'Referral Code (Optional)', Icons.group),
                  if (_isExistingCustomer) ...[
                    const SizedBox(height: 12),
                    Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(color: Colors.greenAccent.withOpacity(0.1), borderRadius: BorderRadius.circular(8)),
                      child: Text('Available Cashback: ₹$_availableCashback', style: const TextStyle(color: Colors.greenAccent, fontWeight: FontWeight.bold, fontSize: 12)),
                    )
                  ]
                ],
              ),
            ),
            const SizedBox(height: 24),
            
            // Product Selection
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: AppColors.darkSurface.withOpacity(0.5),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: Colors.white.withOpacity(0.05)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Sunglasses Selection', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16)),
                  const SizedBox(height: 16),
                  _inputField(_barcodeCtrl, 'Scan Barcode', Icons.qr_code_scanner),
                  const Padding(
                    padding: EdgeInsets.symmetric(vertical: 12),
                    child: Center(child: Text('OR', style: TextStyle(color: AppColors.textGray, fontSize: 12, fontWeight: FontWeight.bold))),
                  ),
                  DropdownButtonFormField<String>(
                    value: _selectedProductId,
                    dropdownColor: AppColors.darkSurface,
                    style: const TextStyle(color: Colors.white),
                    decoration: InputDecoration(
                      labelText: 'Select Product',
                      labelStyle: const TextStyle(color: AppColors.textGray),
                      filled: true,
                      fillColor: Colors.black12,
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: BorderSide.none),
                    ),
                    items: _sunglasses.map((s) {
                      return DropdownMenuItem<String>(
                        value: s['product_id'],
                        child: Text('${s['brand']} - ${s['name']} (₹${s['selling_price']})', overflow: TextOverflow.ellipsis),
                      );
                    }).toList(),
                    onChanged: (val) {
                      if (val != null) {
                        setState(() {
                          _selectedProductId = val;
                          _selectedProduct = _sunglasses.firstWhere((x) => x['product_id'] == val);
                        });
                      }
                    },
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),
            
            // Pricing & Billing
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: AppColors.darkSurface.withOpacity(0.5),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: AppColors.gold.withOpacity(0.2)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Text('Billing Summary', style: TextStyle(color: AppColors.gold, fontWeight: FontWeight.bold, fontSize: 16)),
                  const SizedBox(height: 16),
                  
                  _buildSummaryRow('Subtotal', _subtotal),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: TextField(
                          controller: _discountCtrl,
                          keyboardType: TextInputType.number,
                          onChanged: (_) => setState((){}),
                          style: const TextStyle(color: Colors.white, fontSize: 12),
                          decoration: InputDecoration(
                            labelText: 'Discount (₹)',
                            labelStyle: const TextStyle(color: AppColors.textGray, fontSize: 10),
                            filled: true,
                            fillColor: Colors.black12,
                            isDense: true,
                            border: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: BorderSide.none),
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: TextField(
                          controller: _cashbackCtrl,
                          keyboardType: TextInputType.number,
                          onChanged: (_) => setState((){}),
                          style: const TextStyle(color: Colors.white, fontSize: 12),
                          decoration: InputDecoration(
                            labelText: 'Use Cashback (₹)',
                            labelStyle: const TextStyle(color: AppColors.textGray, fontSize: 10),
                            filled: true,
                            fillColor: Colors.black12,
                            isDense: true,
                            border: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: BorderSide.none),
                          ),
                        ),
                      ),
                    ],
                  ),
                  const Divider(color: Colors.white10, height: 24),
                  _buildSummaryRow('Total Amount', _total, isBold: true, color: Colors.greenAccent),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _advanceCtrl,
                    keyboardType: TextInputType.number,
                    onChanged: (_) => setState((){}),
                    style: const TextStyle(color: Colors.white, fontSize: 12),
                    decoration: InputDecoration(
                      labelText: 'Advance Paid (₹)',
                      labelStyle: const TextStyle(color: AppColors.textGray, fontSize: 10),
                      filled: true,
                      fillColor: Colors.black12,
                      isDense: true,
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: BorderSide.none),
                    ),
                  ),
                  const SizedBox(height: 12),
                  _buildSummaryRow('Balance Due', _balance, color: _balance > 0 ? Colors.redAccent : Colors.grey),
                  
                  const SizedBox(height: 24),
                  ElevatedButton.icon(
                    onPressed: _isSaving ? null : _generateBill,
                    icon: _isSaving 
                        ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(color: AppColors.darkBg, strokeWidth: 2))
                        : const Icon(Icons.receipt, color: AppColors.darkBg),
                    label: const Text('GENERATE BILL', style: TextStyle(color: AppColors.darkBg, fontWeight: FontWeight.bold, fontSize: 16)),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.gold,
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSummaryRow(String label, double value, {bool isBold = false, Color color = Colors.white}) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(label, style: TextStyle(color: color, fontWeight: isBold ? FontWeight.bold : FontWeight.normal, fontSize: isBold ? 16 : 14)),
        Text('₹${value.toStringAsFixed(2)}', style: TextStyle(color: color, fontWeight: isBold ? FontWeight.bold : FontWeight.normal, fontSize: isBold ? 18 : 14)),
      ],
    );
  }

  Widget _inputField(TextEditingController ctrl, String label, IconData icon, {TextInputType? keyboardType, int? maxLength}) {
    return TextField(
      controller: ctrl,
      keyboardType: keyboardType,
      maxLength: maxLength,
      style: const TextStyle(color: Colors.white),
      decoration: InputDecoration(
        labelText: label,
        labelStyle: const TextStyle(color: AppColors.textGray),
        prefixIcon: Icon(icon, color: Colors.grey, size: 18),
        filled: true,
        fillColor: Colors.black12,
        counterText: '',
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: BorderSide.none),
      ),
    );
  }
}
