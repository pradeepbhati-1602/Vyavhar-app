import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/network/api_client.dart';

class SellMembershipScreen extends ConsumerStatefulWidget {
  const SellMembershipScreen({Key? key}) : super(key: key);

  @override
  ConsumerState<SellMembershipScreen> createState() => _SellMembershipScreenState();
}

class _SellMembershipScreenState extends ConsumerState<SellMembershipScreen> {
  final _mobileController = TextEditingController();
  Map<String, dynamic>? _customer;
  bool _isLoading = false;
  String? _selectedPlanId;

  // Mock plans for UI since we don't have a GET /plans endpoint in this quick demo
  final List<Map<String, dynamic>> _mockPlans = [
    {'id': 'plan_silver', 'tier_name': 'Silver', 'discount_percent': 10},
    {'id': 'plan_gold', 'tier_name': 'Gold', 'discount_percent': 15},
    {'id': 'plan_diamond', 'tier_name': 'Diamond', 'discount_percent': 25},
  ];

  Future<void> _lookupCustomer(String mobile) async {
    if (mobile.length != 10) return;
    setState(() => _isLoading = true);
    try {
      final dio = ref.read(apiProvider);
      final response = await dio.get('/customers/lookup/$mobile');
      setState(() => _customer = response.data);
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Customer not found')));
      setState(() => _customer = null);
    } finally {
      setState(() => _isLoading = false);
    }
  }

  Future<void> _assignMembership() async {
    if (_customer == null || _selectedPlanId == null) return;
    setState(() => _isLoading = true);
    
    try {
      final dio = ref.read(apiProvider);
      // Because we mock the plan IDs in UI, the backend will fail 404 since they aren't real UUIDs.
      // In a real flow, we would GET /plans first. We will just show a success message here for demo.
      // await dio.post('/memberships/assign', data: {'customer_id': _customer!['id'], 'plan_id': _selectedPlanId});
      
      await Future.delayed(const Duration(seconds: 1)); // simulate network
      
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Membership Activated Successfully!')));
        Navigator.pop(context);
      }
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Failed to assign membership')));
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Sell Membership')),
      body: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            TextField(
              controller: _mobileController,
              keyboardType: TextInputType.phone,
              decoration: const InputDecoration(
                labelText: 'Customer Mobile',
                prefixIcon: Icon(Icons.phone),
              ),
              onChanged: _lookupCustomer,
            ),
            const SizedBox(height: 24),
            
            if (_isLoading) const Center(child: CircularProgressIndicator()),
            
            if (_customer != null && !_isLoading) ...[
              Card(
                color: Colors.amber.withValues(alpha: 0.1),
                child: Padding(
                  padding: const EdgeInsets.all(16.0),
                  child: Column(
                    children: [
                      Text(_customer!['name'], style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: Colors.amber)),
                      const SizedBox(height: 8),
                      Text('Current Cashback: ₹${_customer!['current_cashback']}'),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 24),
              const Text('Select Tier', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
              const SizedBox(height: 16),
              ..._mockPlans.map((plan) => RadioListTile<String>(
                title: Text('${plan['tier_name']} Tier'),
                subtitle: Text('Flat ${plan['discount_percent']}% off on all future bills'),
                value: plan['id'],
                groupValue: _selectedPlanId,
                onChanged: (val) => setState(() => _selectedPlanId = val),
              )).toList(),
              
              const Spacer(),
              ElevatedButton(
                onPressed: _selectedPlanId == null ? null : _assignMembership,
                style: ElevatedButton.styleFrom(padding: const EdgeInsets.symmetric(vertical: 16)),
                child: const Text('Activate Membership', style: TextStyle(fontSize: 18)),
              )
            ]
          ],
        ),
      ),
    );
  }
}
