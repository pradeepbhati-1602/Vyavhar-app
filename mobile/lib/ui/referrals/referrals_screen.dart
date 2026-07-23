import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/network/api_client.dart';
import '../theme/app_colors.dart';

class ReferralsScreen extends ConsumerStatefulWidget {
  const ReferralsScreen({Key? key}) : super(key: key);

  @override
  ConsumerState<ReferralsScreen> createState() => _ReferralsScreenState();
}

class _ReferralsScreenState extends ConsumerState<ReferralsScreen> {
  bool _isLoading = false;
  bool _isSaving = false;
  List<dynamic> _members = [];
  bool _showAddForm = false;

  final _nameCtrl = TextEditingController();
  final _mobileCtrl = TextEditingController();

  @override
  void initState() {
    super.initState();
    _fetchMembers();
  }

  Future<void> _fetchMembers() async {
    setState(() => _isLoading = true);
    try {
      final dio = ref.read(apiProvider);
      dynamic res;
      try {
        res = await dio.get('/v1/customers/referrals/all');
      } catch (e) {
        res = await dio.get('/customers/referrals/all');
      }
      setState(() {
        _members = res.data;
      });
    } catch (e) {
      debugPrint('Failed to load referrals: $e');
    } finally {
      setState(() => _isLoading = false);
    }
  }

  Future<void> _registerPartner() async {
    if (_nameCtrl.text.isEmpty || _mobileCtrl.text.length != 10) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Please enter valid name and 10-digit mobile')));
      return;
    }

    setState(() => _isSaving = true);
    try {
      final dio = ref.read(apiProvider);
      try {
        await dio.post('/v1/customers/referrals', data: {
          'customer_name': _nameCtrl.text,
          'mobile': _mobileCtrl.text
        });
      } catch (e) {
        await dio.post('/customers/referrals', data: {
          'customer_name': _nameCtrl.text,
          'mobile': _mobileCtrl.text
        });
      }

      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Partner Registered Successfully')));
      
      _nameCtrl.clear();
      _mobileCtrl.clear();
      setState(() => _showAddForm = false);
      
      await _fetchMembers();
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: $e')));
    } finally {
      setState(() => _isSaving = false);
    }
  }

  Future<void> _toggleStatus(String id, String currentStatus) async {
    final nextStatus = currentStatus == 'Active' ? 'Inactive' : 'Active';
    try {
      final dio = ref.read(apiProvider);
      try {
        await dio.put('/v1/customers/referrals/$id/status', data: {'status': nextStatus});
      } catch (e) {
        await dio.put('/customers/referrals/$id/status', data: {'status': nextStatus});
      }
      await _fetchMembers();
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Failed to update status: $e')));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.darkBg,
      appBar: AppBar(
        title: const Text('Referrals & Cashback', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
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
    if (_isLoading) {
      return const Center(child: CircularProgressIndicator(color: AppColors.gold));
    }

    if (_members.isEmpty) {
      return const Center(child: Text('No marketing partners found.', style: TextStyle(color: AppColors.textGray)));
    }

    return ListView.separated(
      padding: const EdgeInsets.all(16),
      itemCount: _members.length,
      separatorBuilder: (_, __) => const SizedBox(height: 16),
      itemBuilder: (context, index) {
        final m = _members[index];
        final isActive = m['status'] == 'Active';
        
        return Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: AppColors.darkSurface.withOpacity(0.5),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: Colors.white.withOpacity(0.05)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(m['name'], style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16)),
                        const SizedBox(height: 2),
                        Text(m['mobile'], style: const TextStyle(color: AppColors.textGray, fontSize: 12, fontFamily: 'monospace')),
                      ],
                    ),
                  ),
                  Switch(
                    value: isActive,
                    activeColor: AppColors.gold,
                    onChanged: (val) => _toggleStatus(m['customer_id'], m['status']),
                  ),
                ],
              ),
              const Divider(color: Colors.white10, height: 24),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceAround,
                children: [
                  Column(
                    children: [
                      Text('${m['referral_count']}', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 18)),
                      const Text('REFERRALS', style: TextStyle(color: AppColors.textGray, fontSize: 10, letterSpacing: 1)),
                    ],
                  ),
                  Container(width: 1, height: 30, color: Colors.white10),
                  Column(
                    children: [
                      Text('₹${m['cashback_balance']}', style: const TextStyle(color: Colors.greenAccent, fontWeight: FontWeight.bold, fontSize: 18)),
                      const Text('CASHBACK', style: TextStyle(color: AppColors.textGray, fontSize: 10, letterSpacing: 1)),
                    ],
                  ),
                ],
              ),
            ],
          ),
        );
      },
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
            const Text('Register New Partner', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 18)),
            const SizedBox(height: 24),
            TextField(
              controller: _nameCtrl,
              style: const TextStyle(color: Colors.white),
              decoration: InputDecoration(
                labelText: 'Partner Name *',
                labelStyle: const TextStyle(color: AppColors.textGray),
                prefixIcon: const Icon(Icons.person, color: Colors.grey, size: 18),
                filled: true,
                fillColor: Colors.black12,
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: BorderSide.none),
              ),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: _mobileCtrl,
              keyboardType: TextInputType.phone,
              maxLength: 10,
              style: const TextStyle(color: Colors.white),
              decoration: InputDecoration(
                labelText: 'Mobile Number *',
                labelStyle: const TextStyle(color: AppColors.textGray),
                prefixIcon: const Icon(Icons.phone, color: Colors.grey, size: 18),
                filled: true,
                fillColor: Colors.black12,
                counterText: '',
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: BorderSide.none),
              ),
            ),
            const SizedBox(height: 24),
            ElevatedButton(
              onPressed: _isSaving ? null : _registerPartner,
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.gold,
                padding: const EdgeInsets.symmetric(vertical: 16),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              child: _isSaving 
                  ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(color: AppColors.darkBg, strokeWidth: 2))
                  : const Text('Register Partner', style: TextStyle(color: AppColors.darkBg, fontWeight: FontWeight.bold, fontSize: 16)),
            ),
          ],
        ),
      ),
    );
  }
}
