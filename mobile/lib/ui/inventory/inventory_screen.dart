import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/network/api_client.dart';
import '../theme/app_colors.dart';

class InventoryScreen extends ConsumerStatefulWidget {
  const InventoryScreen({Key? key}) : super(key: key);

  @override
  ConsumerState<InventoryScreen> createState() => _InventoryScreenState();
}

class _InventoryScreenState extends ConsumerState<InventoryScreen> {
  bool _isLoading = false;
  bool _isSaving = false;
  List<dynamic> _products = [];
  bool _showAddForm = false;
  
  String _activeCategory = 'All';
  String _searchQuery = '';
  final List<String> _categories = ['All', 'Frames', 'Contact Lens', 'Reading Glasses', 'Sunglasses', 'Accessories', 'Lens', 'Repair Parts'];
  
  final _searchCtrl = TextEditingController();

  // Add Product Form Controllers
  final _barcodeCtrl = TextEditingController();
  final _brandCtrl = TextEditingController();
  final _nameCtrl = TextEditingController();
  final _purchaseCtrl = TextEditingController();
  final _sellingCtrl = TextEditingController();
  final _stockCtrl = TextEditingController();

  @override
  void initState() {
    super.initState();
    _fetchInventory();
  }

  Future<void> _fetchInventory() async {
    setState(() => _isLoading = true);
    try {
      final dio = ref.read(apiProvider);
      dynamic res;
      try {
        res = await dio.get('/v1/products', queryParameters: {
          'category': _activeCategory,
          'search': _searchQuery,
          'is_paginated': 'true',
          'limit': 50,
        });
      } catch (e) {
        res = await dio.get('/products', queryParameters: {
          'category': _activeCategory,
          'search': _searchQuery,
          'is_paginated': 'true',
          'limit': 50,
        });
      }
      setState(() {
        _products = res.data['data'] ?? [];
      });
    } catch (e) {
      debugPrint('Failed to load inventory: $e');
    } finally {
      setState(() => _isLoading = false);
    }
  }

  Future<void> _addProduct() async {
    if (_barcodeCtrl.text.isEmpty || _brandCtrl.text.isEmpty || _nameCtrl.text.isEmpty || _purchaseCtrl.text.isEmpty || _sellingCtrl.text.isEmpty || _stockCtrl.text.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Please fill all mandatory fields')));
      return;
    }

    setState(() => _isSaving = true);
    try {
      final payload = {
        'barcode': _barcodeCtrl.text,
        'category': _activeCategory == 'All' ? 'Frames' : _activeCategory,
        'brand': _brandCtrl.text,
        'name': _nameCtrl.text,
        'purchase_price': double.tryParse(_purchaseCtrl.text) ?? 0,
        'selling_price': double.tryParse(_sellingCtrl.text) ?? 0,
        'stock_quantity': int.tryParse(_stockCtrl.text) ?? 0,
        'low_stock_threshold': 5
      };

      final dio = ref.read(apiProvider);
      try {
        await dio.post('/v1/products', data: payload);
      } catch (e) {
        await dio.post('/products', data: payload);
      }

      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Product added successfully')));
      
      _barcodeCtrl.clear();
      _brandCtrl.clear();
      _nameCtrl.clear();
      _purchaseCtrl.clear();
      _sellingCtrl.clear();
      _stockCtrl.clear();
      setState(() => _showAddForm = false);
      
      await _fetchInventory();
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
        title: const Text('Products & Inventory', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
        backgroundColor: AppColors.darkSurface,
        iconTheme: const IconThemeData(color: Colors.white),
        actions: [
          IconButton(
            icon: Icon(_showAddForm ? Icons.close : Icons.add, color: AppColors.gold),
            onPressed: () => setState(() => _showAddForm = !_showAddForm),
          ),
        ],
      ),
      body: _showAddForm ? _buildAddForm() : _buildList(),
    );
  }

  Widget _buildList() {
    return Padding(
      padding: const EdgeInsets.all(16.0),
      child: Column(
        children: [
          TextField(
            controller: _searchCtrl,
            style: const TextStyle(color: Colors.white),
            decoration: InputDecoration(
              hintText: 'Search barcode, name, brand...',
              hintStyle: const TextStyle(color: AppColors.textGray),
              prefixIcon: const Icon(Icons.search, color: Colors.grey),
              suffixIcon: IconButton(
                icon: const Icon(Icons.arrow_forward, color: AppColors.gold),
                onPressed: () {
                  _searchQuery = _searchCtrl.text;
                  _fetchInventory();
                },
              ),
              filled: true,
              fillColor: AppColors.darkSurface.withOpacity(0.5),
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
            ),
            onSubmitted: (val) {
              _searchQuery = val;
              _fetchInventory();
            },
          ),
          const SizedBox(height: 12),
          SizedBox(
            height: 40,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: _categories.length,
              separatorBuilder: (_, __) => const SizedBox(width: 8),
              itemBuilder: (context, index) {
                final cat = _categories[index];
                final isSelected = _activeCategory == cat;
                return ChoiceChip(
                  label: Text(cat, style: TextStyle(color: isSelected ? AppColors.darkBg : Colors.white, fontWeight: FontWeight.bold)),
                  selected: isSelected,
                  selectedColor: AppColors.gold,
                  backgroundColor: AppColors.darkSurface,
                  onSelected: (val) {
                    if (val) {
                      setState(() => _activeCategory = cat);
                      _fetchInventory();
                    }
                  },
                );
              },
            ),
          ),
          const SizedBox(height: 16),
          Expanded(
            child: _isLoading 
              ? const Center(child: CircularProgressIndicator(color: AppColors.gold))
              : _products.isEmpty 
                ? const Center(child: Text('No products found in this category.', style: TextStyle(color: AppColors.textGray)))
                : ListView.separated(
                    itemCount: _products.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 8),
                    itemBuilder: (context, index) {
                      final p = _products[index];
                      final stock = p['stock_quantity'] as int;
                      final lowStock = stock <= (p['low_stock_threshold'] as int);
                      
                      return Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: AppColors.darkSurface.withOpacity(0.5),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: Colors.white.withOpacity(0.05)),
                        ),
                        child: Row(
                          children: [
                            Container(
                              width: 40,
                              height: 40,
                              decoration: BoxDecoration(
                                color: Colors.white10,
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: const Icon(Icons.inventory_2, color: AppColors.textGray, size: 20),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(p['name'], style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14)),
                                  Text('${p['brand']} • ${p['barcode']}', style: const TextStyle(color: AppColors.textGray, fontSize: 10, fontFamily: 'monospace')),
                                ],
                              ),
                            ),
                              Column(
                              crossAxisAlignment: CrossAxisAlignment.end,
                              children: [
                                Text('₹${p['selling_price']}', style: const TextStyle(color: Colors.greenAccent, fontWeight: FontWeight.bold, fontSize: 14)),
                                Row(
                                  children: [
                                    if (lowStock) const Icon(Icons.warning, color: Colors.redAccent, size: 10),
                                    const SizedBox(width: 4),
                                    Text('STOCK: $stock', style: TextStyle(color: lowStock ? Colors.redAccent : AppColors.textGray, fontSize: 10, fontWeight: FontWeight.bold)),
                                    const SizedBox(width: 8),
                                    InkWell(
                                      onTap: () => _showAdjustStockModal(p),
                                      child: const Icon(Icons.edit, color: AppColors.gold, size: 16),
                                    ),
                                  ],
                                ),
                              ],
                            ),
                          ],
                        ),
                      );
                    },
                  ),
          ),
        ],
      ),
    );
  }

  Widget _buildAddForm() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: AppColors.darkSurface.withOpacity(0.5),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: Colors.white.withOpacity(0.05)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Text('Add New Product', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 18)),
            const SizedBox(height: 24),
            _inputField(_barcodeCtrl, 'Barcode / SKU', Icons.qr_code),
            const SizedBox(height: 16),
            _inputField(_brandCtrl, 'Brand Name', Icons.branding_watermark),
            const SizedBox(height: 16),
            _inputField(_nameCtrl, 'Product Name', Icons.inventory),
            const SizedBox(height: 16),
            Row(
              children: [
                Expanded(child: _inputField(_purchaseCtrl, 'Purchase Price (₹)', Icons.money, keyboardType: TextInputType.number)),
                const SizedBox(width: 12),
                Expanded(child: _inputField(_sellingCtrl, 'Selling Price (₹)', Icons.money, keyboardType: TextInputType.number)),
              ],
            ),
            const SizedBox(height: 16),
            _inputField(_stockCtrl, 'Initial Stock Qty', Icons.layers, keyboardType: TextInputType.number),
            const SizedBox(height: 24),
            ElevatedButton(
              onPressed: _isSaving ? null : _addProduct,
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.gold,
                padding: const EdgeInsets.symmetric(vertical: 16),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              child: _isSaving 
                  ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(color: AppColors.darkBg, strokeWidth: 2))
                  : const Text('Add Product to Inventory', style: TextStyle(color: AppColors.darkBg, fontWeight: FontWeight.bold, fontSize: 16)),
            ),
          ],
        ),
      ),
    );
  }

  Widget _inputField(TextEditingController ctrl, String label, IconData icon, {TextInputType? keyboardType}) {
    return TextField(
      controller: ctrl,
      keyboardType: keyboardType,
      style: const TextStyle(color: Colors.white),
      decoration: InputDecoration(
        labelText: label,
        labelStyle: const TextStyle(color: AppColors.textGray),
        prefixIcon: Icon(icon, color: Colors.grey, size: 18),
        filled: true,
        fillColor: Colors.black12,
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: BorderSide.none),
      ),
    );
  }

  void _showAdjustStockModal(dynamic product) {
    final qtyCtrl = TextEditingController();
    
    showDialog(
      context: context,
      builder: (context) {
        return AlertDialog(
          backgroundColor: AppColors.darkSurface,
          title: Text('Adjust Stock: ${product['name']}', style: const TextStyle(color: Colors.white)),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text('Current Stock: ${product['stock_quantity']}', style: const TextStyle(color: AppColors.textGray)),
              const SizedBox(height: 16),
              TextField(
                controller: qtyCtrl,
                keyboardType: const TextInputType.numberWithOptions(signed: true),
                style: const TextStyle(color: Colors.white),
                decoration: const InputDecoration(
                  labelText: 'Adjustment Quantity (+/-)',
                  labelStyle: TextStyle(color: AppColors.textGray),
                  filled: true,
                  fillColor: Colors.black12,
                ),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Cancel'),
            ),
            ElevatedButton(
              onPressed: () async {
                final val = int.tryParse(qtyCtrl.text);
                if (val != null && val != 0) {
                  Navigator.pop(context);
                  await _adjustStock(product['id'], val);
                }
              },
              style: ElevatedButton.styleFrom(backgroundColor: AppColors.gold, foregroundColor: AppColors.darkBg),
              child: const Text('Save'),
            ),
          ],
        );
      },
    );
  }

  Future<void> _adjustStock(String id, int adjustment) async {
    setState(() => _isLoading = true);
    try {
      final dio = ref.read(apiProvider);
      await dio.post('/products/$id/adjust-stock', data: {
        'adjustment_quantity': adjustment,
        'reason': 'Manual Adjustment'
      });
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Stock adjusted successfully')));
      await _fetchInventory();
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Failed to adjust stock: $e')));
      setState(() => _isLoading = false);
    }
  }
}
