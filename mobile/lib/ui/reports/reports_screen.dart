import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/network/api_client.dart';
import '../theme/app_colors.dart';

class ReportsScreen extends ConsumerStatefulWidget {
  const ReportsScreen({Key? key}) : super(key: key);

  @override
  ConsumerState<ReportsScreen> createState() => _ReportsScreenState();
}

class _ReportsScreenState extends ConsumerState<ReportsScreen> {
  bool _isLoading = false;
  List<dynamic> _bills = [];
  String _searchQuery = '';
  
  final _searchCtrl = TextEditingController();

  @override
  void initState() {
    super.initState();
    _fetchBills();
  }

  Future<void> _fetchBills() async {
    setState(() => _isLoading = true);
    try {
      final dio = ref.read(apiProvider);
      dynamic res;
      try {
        res = await dio.get('/v1/bills', queryParameters: {
          'search': _searchQuery,
          'is_paginated': 'true',
          'limit': 50,
        });
      } catch (e) {
        res = await dio.get('/bills', queryParameters: {
          'search': _searchQuery,
          'is_paginated': 'true',
          'limit': 50,
        });
      }
      setState(() {
        _bills = res.data['data'] ?? [];
      });
    } catch (e) {
      debugPrint('Failed to load bills for reports: $e');
    } finally {
      setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.darkBg,
      appBar: AppBar(
        title: const Text('Reports & Ledger', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
        backgroundColor: AppColors.darkSurface,
        iconTheme: const IconThemeData(color: Colors.white),
      ),
      body: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          children: [
            TextField(
              controller: _searchCtrl,
              style: const TextStyle(color: Colors.white),
              decoration: InputDecoration(
                hintText: 'Search invoice, mobile...',
                hintStyle: const TextStyle(color: AppColors.textGray),
                prefixIcon: const Icon(Icons.search, color: Colors.grey),
                suffixIcon: IconButton(
                  icon: const Icon(Icons.arrow_forward, color: AppColors.gold),
                  onPressed: () {
                    _searchQuery = _searchCtrl.text;
                    _fetchBills();
                  },
                ),
                filled: true,
                fillColor: AppColors.darkSurface.withOpacity(0.5),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
              ),
              onSubmitted: (val) {
                _searchQuery = val;
                _fetchBills();
              },
            ),
            const SizedBox(height: 16),
            
            // Export Section Placeholder
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: AppColors.darkSurface.withOpacity(0.5),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: Colors.white.withOpacity(0.05)),
              ),
              child: Row(
                children: [
                  const Icon(Icons.file_download, color: AppColors.gold, size: 20),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: const [
                        Text('Data Exports', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14)),
                        Text('CSV downloads available on Desktop Web app', style: TextStyle(color: AppColors.textGray, fontSize: 10)),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            
            // Ledger List
            Expanded(
              child: _isLoading 
                ? const Center(child: CircularProgressIndicator(color: AppColors.gold))
                : _bills.isEmpty 
                  ? const Center(child: Text('No bills found.', style: TextStyle(color: AppColors.textGray)))
                  : ListView.separated(
                      itemCount: _bills.length,
                      separatorBuilder: (_, __) => const SizedBox(height: 8),
                      itemBuilder: (context, index) {
                        final b = _bills[index];
                        final isPaid = b['payment_status'] == 'PAID';
                        return Container(
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: AppColors.darkSurface.withOpacity(0.5),
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(color: Colors.white.withOpacity(0.05)),
                          ),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text('Inv: ${b['invoice_number']}', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14)),
                                    Text(b['customer_name'] ?? 'Walk-in', style: const TextStyle(color: AppColors.textGray, fontSize: 12)),
                                    Text(b['created_at'].toString().split('T')[0], style: const TextStyle(color: AppColors.textGray, fontSize: 10)),
                                  ],
                                ),
                              ),
                              Column(
                                crossAxisAlignment: CrossAxisAlignment.end,
                                children: [
                                  Text('₹${b['total_amount']}', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14)),
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                    decoration: BoxDecoration(
                                      color: isPaid ? Colors.greenAccent.withOpacity(0.1) : Colors.redAccent.withOpacity(0.1),
                                      borderRadius: BorderRadius.circular(4),
                                    ),
                                    child: Text(
                                      b['payment_status'],
                                      style: TextStyle(color: isPaid ? Colors.greenAccent : Colors.redAccent, fontSize: 8, fontWeight: FontWeight.bold),
                                    ),
                                  ),
                                  if (!isPaid)
                                    Text('Due: ₹${b['due_amount']}', style: const TextStyle(color: Colors.redAccent, fontSize: 10, fontWeight: FontWeight.bold)),
                                  const SizedBox(height: 8),
                                  if (b['status'] != 'CANCELLED')
                                    InkWell(
                                      onTap: () => _confirmCancelBill(b['id'], b['invoice_number']),
                                      child: const Text('CANCEL BILL', style: TextStyle(color: Colors.red, fontSize: 10, fontWeight: FontWeight.bold)),
                                    )
                                  else
                                    const Text('CANCELLED', style: TextStyle(color: Colors.grey, fontSize: 10, fontWeight: FontWeight.bold)),
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
      ),
    );
  }

  void _confirmCancelBill(String billId, String invoiceNumber) {
    showDialog(
      context: context,
      builder: (context) {
        return AlertDialog(
          backgroundColor: AppColors.darkSurface,
          title: const Text('Cancel Bill?', style: TextStyle(color: Colors.white)),
          content: Text('Are you sure you want to cancel Invoice $invoiceNumber? This will reverse stock and financials. This action cannot be undone.', style: const TextStyle(color: AppColors.textGray)),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('No, Keep It'),
            ),
            ElevatedButton(
              onPressed: () async {
                Navigator.pop(context);
                await _cancelBill(billId);
              },
              style: ElevatedButton.styleFrom(backgroundColor: Colors.red, foregroundColor: Colors.white),
              child: const Text('Yes, Cancel Bill'),
            ),
          ],
        );
      },
    );
  }

  Future<void> _cancelBill(String billId) async {
    setState(() => _isLoading = true);
    try {
      final dio = ref.read(apiProvider);
      await dio.post('/bills/$billId/cancel');
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Bill cancelled successfully')));
      await _fetchBills();
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Failed to cancel bill: $e')));
      setState(() => _isLoading = false);
    }
  }
}
