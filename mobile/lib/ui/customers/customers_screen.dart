import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/network/api_client.dart';
import '../theme/app_colors.dart';
import 'customer_detail_screen.dart';

class CustomersScreen extends ConsumerStatefulWidget {
  const CustomersScreen({Key? key}) : super(key: key);

  @override
  ConsumerState<CustomersScreen> createState() => _CustomersScreenState();
}

class _CustomersScreenState extends ConsumerState<CustomersScreen> {
  bool _isLoading = false;
  List<dynamic> _customers = [];
  String _searchQuery = '';
  
  final _searchCtrl = TextEditingController();

  @override
  void initState() {
    super.initState();
    _fetchCustomers();
  }

  Future<void> _fetchCustomers() async {
    setState(() => _isLoading = true);
    try {
      final dio = ref.read(apiProvider);
      dynamic res;
      try {
        res = await dio.get('/v1/customers', queryParameters: {
          'search': _searchQuery,
          'is_paginated': 'true',
          'limit': 50,
        });
      } catch (e) {
        res = await dio.get('/customers', queryParameters: {
          'search': _searchQuery,
          'is_paginated': 'true',
          'limit': 50,
        });
      }
      setState(() {
        _customers = res.data['data'] ?? [];
      });
    } catch (e) {
      debugPrint('Failed to load customers: $e');
    } finally {
      setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.darkBg,
      appBar: AppBar(
        title: const Text('Customer Directory', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
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
                hintText: 'Search name or mobile...',
                hintStyle: const TextStyle(color: AppColors.textGray),
                prefixIcon: const Icon(Icons.search, color: Colors.grey),
                suffixIcon: IconButton(
                  icon: const Icon(Icons.arrow_forward, color: AppColors.gold),
                  onPressed: () {
                    _searchQuery = _searchCtrl.text;
                    _fetchCustomers();
                  },
                ),
                filled: true,
                fillColor: AppColors.darkSurface.withOpacity(0.5),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
              ),
              onSubmitted: (val) {
                _searchQuery = val;
                _fetchCustomers();
              },
            ),
            const SizedBox(height: 16),
            Expanded(
              child: _isLoading 
                ? const Center(child: CircularProgressIndicator(color: AppColors.gold))
                : _customers.isEmpty 
                  ? const Center(child: Text('No customers found.', style: TextStyle(color: AppColors.textGray)))
                  : ListView.separated(
                      itemCount: _customers.length,
                      separatorBuilder: (_, __) => const SizedBox(height: 8),
                      itemBuilder: (context, index) {
                        final c = _customers[index];
                        return ListTile(
                          tileColor: AppColors.darkSurface.withOpacity(0.5),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12), side: BorderSide(color: Colors.white.withOpacity(0.05))),
                          title: Row(
                            children: [
                              Expanded(
                                child: Text(c['name'] ?? '', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14)),
                              ),
                              if (c['has_active_membership'] == true)
                                const Icon(Icons.stars, color: AppColors.gold, size: 16),
                            ],
                          ),
                          subtitle: Text(c['mobile'] ?? '', style: const TextStyle(color: AppColors.textGray, fontSize: 12, fontFamily: 'monospace')),
                          trailing: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            crossAxisAlignment: CrossAxisAlignment.end,
                            children: [
                              Text('₹${c['total_purchase']}', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 12)),
                              const Text('SPENT', style: TextStyle(color: AppColors.textGray, fontSize: 8, fontWeight: FontWeight.bold)),
                            ],
                          ),
                          onTap: () {
                            Navigator.push(context, MaterialPageRoute(builder: (_) => CustomerDetailScreen(customerId: c['customer_id'])));
                          },
                        );
                      },
                    ),
            ),
          ],
        ),
      ),
    );
  }
}
