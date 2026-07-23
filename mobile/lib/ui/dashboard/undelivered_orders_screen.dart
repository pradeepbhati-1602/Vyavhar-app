import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/network/api_client.dart';
import '../../core/providers/dashboard_provider.dart';

class UndeliveredOrdersScreen extends ConsumerStatefulWidget {
  const UndeliveredOrdersScreen({Key? key}) : super(key: key);

  @override
  ConsumerState<UndeliveredOrdersScreen> createState() => _UndeliveredOrdersScreenState();
}

class _UndeliveredOrdersScreenState extends ConsumerState<UndeliveredOrdersScreen> {
  List<dynamic> _orders = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _fetchOrders();
  }

  Future<void> _fetchOrders() async {
    setState(() => _isLoading = true);
    try {
      final dio = ref.read(apiProvider);
      // Let's assume a generic GET /bills?delivery_status=PENDING endpoint exists, 
      // but since we only have a limited backend so far, we will mock the list or 
      // you could create that endpoint later. For now, let's mock it for the UI.
      await Future.delayed(const Duration(milliseconds: 500));
      setState(() {
        _orders = [
          {'id': 'dummy-bill-id', 'invoice_number': 'INV-12345', 'customer': {'name': 'John Doe'}, 'total_amount': 2500}
        ];
      });
    } catch (e) {
      // Handle error
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _markAsDelivered(String id) async {
    try {
      final dio = ref.read(apiProvider);
      await dio.put('/bills/$id/deliver');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Marked as Delivered & WhatsApp sent!')));
        _fetchOrders(); // refresh list
        ref.read(dashboardProvider.notifier).fetchDashboard(); // update dashboard count
      }
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Failed to deliver')));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Pending Orders')),
      body: _isLoading 
        ? const Center(child: CircularProgressIndicator()) 
        : _orders.isEmpty 
          ? const Center(child: Text('No pending orders!'))
          : ListView.builder(
              itemCount: _orders.length,
              itemBuilder: (context, index) {
                final order = _orders[index];
                return ListTile(
                  title: Text('${order['invoice_number']} - ${order['customer']['name']}'),
                  subtitle: Text('Total: ₹${order['total_amount']}'),
                  trailing: ElevatedButton(
                    onPressed: () => _markAsDelivered(order['id']),
                    child: const Text('Mark Delivered'),
                  ),
                );
              },
            ),
    );
  }
}
