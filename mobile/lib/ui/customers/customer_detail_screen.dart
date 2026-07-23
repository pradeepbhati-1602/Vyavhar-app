import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/network/api_client.dart';
import '../theme/app_colors.dart';

class CustomerDetailScreen extends ConsumerStatefulWidget {
  final String customerId;

  const CustomerDetailScreen({Key? key, required this.customerId}) : super(key: key);

  @override
  ConsumerState<CustomerDetailScreen> createState() => _CustomerDetailScreenState();
}

class _CustomerDetailScreenState extends ConsumerState<CustomerDetailScreen> {
  bool _isLoading = true;
  Map<String, dynamic>? _profile;

  @override
  void initState() {
    super.initState();
    _fetchProfile();
  }

  Future<void> _fetchProfile() async {
    try {
      final dio = ref.read(apiProvider);
      dynamic res;
      try {
        res = await dio.get('/v1/customers/${widget.customerId}');
      } catch (e) {
        res = await dio.get('/customers/${widget.customerId}');
      }
      setState(() {
        _profile = res.data;
      });
    } catch (e) {
      debugPrint('Failed to load customer profile: $e');
    } finally {
      setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.darkBg,
      appBar: AppBar(
        title: const Text('Customer Profile', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
        backgroundColor: AppColors.darkSurface,
        iconTheme: const IconThemeData(color: Colors.white),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: AppColors.gold))
          : _profile == null
              ? const Center(child: Text('Profile not found', style: TextStyle(color: AppColors.textGray)))
              : SingleChildScrollView(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      // Header Card
                      Container(
                        padding: const EdgeInsets.all(20),
                        decoration: BoxDecoration(
                          gradient: const LinearGradient(
                            colors: [Color(0xFF2A2D35), Color(0xFF1A1D24)],
                            begin: Alignment.topLeft,
                            end: Alignment.bottomRight,
                          ),
                          borderRadius: BorderRadius.circular(24),
                          border: Border.all(color: AppColors.gold.withOpacity(0.3)),
                        ),
                        child: Column(
                          children: [
                            CircleAvatar(
                              radius: 32,
                              backgroundColor: AppColors.gold.withOpacity(0.2),
                              child: Text(
                                _profile!['name'][0].toUpperCase(),
                                style: const TextStyle(color: AppColors.gold, fontSize: 28, fontWeight: FontWeight.bold),
                              ),
                            ),
                            const SizedBox(height: 12),
                            Text(
                              _profile!['name'],
                              style: const TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.bold),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              _profile!['mobile'],
                              style: const TextStyle(color: AppColors.textGray, fontSize: 14, fontFamily: 'monospace', letterSpacing: 1.5),
                            ),
                            const SizedBox(height: 16),
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                              children: [
                                _buildStat('Bills', _profile!['total_bills']?.toString() ?? '0'),
                                _buildStat('Spent', '₹${_profile!['total_purchase'] ?? 0}'),
                                _buildStat('Dues', '₹${_profile!['pending_due'] ?? 0}', color: Colors.redAccent),
                              ],
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 24),
                      
                      // Recent Bills
                      _buildSectionHeader('Recent Bills', Icons.receipt),
                      if ((_profile!['bills'] as List?)?.isEmpty ?? true)
                        const Padding(padding: EdgeInsets.all(16), child: Text('No bills found.', style: TextStyle(color: AppColors.textGray)))
                      else
                        ...(_profile!['bills'] as List).map((b) => _buildBillItem(b)).toList(),
                        
                      const SizedBox(height: 24),
                      
                      // Recent Eye Tests
                      _buildSectionHeader('Eye Tests', Icons.remove_red_eye),
                      if ((_profile!['eye_tests'] as List?)?.isEmpty ?? true)
                        const Padding(padding: EdgeInsets.all(16), child: Text('No eye tests found.', style: TextStyle(color: AppColors.textGray)))
                      else
                        ...(_profile!['eye_tests'] as List).map((t) => _buildEyeTestItem(t)).toList(),
                        
                      const SizedBox(height: 24),
                      
                      // Repairs
                      _buildSectionHeader('Repairs', Icons.build),
                      if ((_profile!['repair_orders'] as List?)?.isEmpty ?? true)
                        const Padding(padding: EdgeInsets.all(16), child: Text('No repairs found.', style: TextStyle(color: AppColors.textGray)))
                      else
                        ...(_profile!['repair_orders'] as List).map((r) => _buildRepairItem(r)).toList(),
                    ],
                  ),
                ),
    );
  }

  Widget _buildStat(String label, String value, {Color color = Colors.white}) {
    return Column(
      children: [
        Text(value, style: TextStyle(color: color, fontSize: 18, fontWeight: FontWeight.bold)),
        Text(label, style: const TextStyle(color: AppColors.textGray, fontSize: 10, fontWeight: FontWeight.bold, letterSpacing: 1)),
      ],
    );
  }

  Widget _buildSectionHeader(String title, IconData icon) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        children: [
          Icon(icon, color: AppColors.gold, size: 20),
          const SizedBox(width: 8),
          Text(title, style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold)),
        ],
      ),
    );
  }

  Widget _buildBillItem(dynamic b) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.darkSurface.withOpacity(0.5),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.white.withOpacity(0.05)),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Invoice: ${b['invoice_number']}', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14)),
              Text(b['created_at'].toString().split('T')[0], style: const TextStyle(color: AppColors.textGray, fontSize: 10)),
            ],
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text('₹${b['total_amount']}', style: const TextStyle(color: AppColors.gold, fontWeight: FontWeight.bold, fontSize: 14)),
              Text(b['payment_status'], style: TextStyle(color: b['payment_status'] == 'PAID' ? Colors.green : Colors.red, fontSize: 10, fontWeight: FontWeight.bold)),
            ],
          )
        ],
      ),
    );
  }

  Widget _buildEyeTestItem(dynamic t) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.darkSurface.withOpacity(0.5),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.white.withOpacity(0.05)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(t['vision_category'] ?? 'Test', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14)),
              Text(t['created_at'].toString().split('T')[0], style: const TextStyle(color: AppColors.textGray, fontSize: 10)),
            ],
          ),
          const SizedBox(height: 8),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceAround,
            children: [
              Text('RE: ${t['re_sph']}/${t['re_cyl']}', style: const TextStyle(color: Colors.grey, fontSize: 11, fontFamily: 'monospace')),
              Text('LE: ${t['le_sph']}/${t['le_cyl']}', style: const TextStyle(color: Colors.grey, fontSize: 11, fontFamily: 'monospace')),
            ],
          )
        ],
      ),
    );
  }

  Widget _buildRepairItem(dynamic r) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
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
                Text(r['repair_type'], style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14)),
                Text(r['frame_details'], style: const TextStyle(color: AppColors.textGray, fontSize: 12)),
              ],
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text('₹${r['charges']}', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 12)),
              const SizedBox(height: 4),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(color: Colors.white10, borderRadius: BorderRadius.circular(4)),
                child: Text(r['repair_status'], style: const TextStyle(color: Colors.blueAccent, fontSize: 8, fontWeight: FontWeight.bold)),
              ),
            ],
          )
        ],
      ),
    );
  }
}
