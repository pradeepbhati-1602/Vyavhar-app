import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/network/api_client.dart';
import '../theme/app_colors.dart';
import 'package:url_launcher/url_launcher.dart';

class RepairsScreen extends ConsumerStatefulWidget {
  const RepairsScreen({Key? key}) : super(key: key);

  @override
  ConsumerState<RepairsScreen> createState() => _RepairsScreenState();
}

class _RepairsScreenState extends ConsumerState<RepairsScreen> {
  bool _isLoading = false;
  bool _isSaving = false;
  List<dynamic> _repairs = [];
  bool _showAddForm = false;

  // Form controllers
  final _nameCtrl = TextEditingController();
  final _mobileCtrl = TextEditingController();
  final _frameCtrl = TextEditingController();
  final _typeCtrl = TextEditingController();
  final _chargesCtrl = TextEditingController();
  final _dateCtrl = TextEditingController();

  @override
  void initState() {
    super.initState();
    _fetchRepairs();
  }

  Future<void> _fetchRepairs() async {
    setState(() => _isLoading = true);
    try {
      final dio = ref.read(apiProvider);
      dynamic res;
      try {
        res = await dio.get('/v1/repairs');
      } catch (e) {
        res = await dio.get('/repairs');
      }
      setState(() {
        _repairs = res.data;
      });
    } catch (e) {
      debugPrint('Failed to load repairs: $e');
    } finally {
      setState(() => _isLoading = false);
    }
  }

  Future<void> _saveRepair() async {
    if (_nameCtrl.text.isEmpty || _mobileCtrl.text.length != 10 || _frameCtrl.text.isEmpty || _typeCtrl.text.isEmpty || _chargesCtrl.text.isEmpty || _dateCtrl.text.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Please fill all mandatory fields')));
      return;
    }

    setState(() => _isSaving = true);
    try {
      final payload = {
        'customer_name': _nameCtrl.text,
        'mobile': _mobileCtrl.text,
        'frame_details': _frameCtrl.text,
        'repair_type': _typeCtrl.text,
        'charges': double.tryParse(_chargesCtrl.text) ?? 0,
        'expected_date': _dateCtrl.text
      };

      final dio = ref.read(apiProvider);
      try {
        await dio.post('/v1/repairs', data: payload);
      } catch (e) {
        await dio.post('/repairs', data: payload);
      }

      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Repair logged successfully')));
      
      _nameCtrl.clear();
      _mobileCtrl.clear();
      _frameCtrl.clear();
      _typeCtrl.clear();
      _chargesCtrl.clear();
      _dateCtrl.clear();
      
      setState(() => _showAddForm = false);
      await _fetchRepairs();
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: $e')));
    } finally {
      setState(() => _isSaving = false);
    }
  }

  Future<void> _updateStatus(String id, String nextStatus) async {
    try {
      final dio = ref.read(apiProvider);
      dynamic res;
      try {
        res = await dio.put('/v1/repairs/$id/status', data: {'repair_status': nextStatus});
      } catch (e) {
        res = await dio.put('/repairs/$id/status', data: {'repair_status': nextStatus});
      }

      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(res.data['toast'] ?? 'Status updated')));
      
      if (res.data['waLink'] != null) {
        final uri = Uri.parse(res.data['waLink']);
        if (await canLaunchUrl(uri)) {
          await launchUrl(uri);
        }
      }
      
      await _fetchRepairs();
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Failed to update status: $e')));
    }
  }

  String _getNextStatus(String currentStatus) {
    switch (currentStatus) {
      case 'RECEIVED': return 'IN_PROGRESS';
      case 'IN_PROGRESS': return 'READY';
      case 'READY': return 'DELIVERED';
      default: return currentStatus;
    }
  }

  Color _getStatusColor(String status) {
    switch (status) {
      case 'RECEIVED': return Colors.grey;
      case 'IN_PROGRESS': return Colors.orangeAccent;
      case 'READY': return Colors.blueAccent;
      case 'DELIVERED': return Colors.greenAccent;
      default: return Colors.grey;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.darkBg,
      appBar: AppBar(
        title: const Text('Repair Orders', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
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

    if (_repairs.isEmpty) {
      return const Center(child: Text('No repair orders found.', style: TextStyle(color: AppColors.textGray)));
    }

    return ListView.separated(
      padding: const EdgeInsets.all(16),
      itemCount: _repairs.length,
      separatorBuilder: (_, __) => const SizedBox(height: 16),
      itemBuilder: (context, index) {
        final r = _repairs[index];
        final nextStatus = _getNextStatus(r['repair_status']);
        final isDelivered = r['repair_status'] == 'DELIVERED';
        
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
                        Text(r['customer']?['name'] ?? 'Unknown', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16)),
                        const SizedBox(height: 2),
                        Text(r['customer']?['mobile'] ?? 'Unknown', style: const TextStyle(color: AppColors.textGray, fontSize: 12)),
                      ],
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: _getStatusColor(r['repair_status']).withOpacity(0.1),
                      border: Border.all(color: _getStatusColor(r['repair_status']).withOpacity(0.5)),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(r['repair_status'], style: TextStyle(color: _getStatusColor(r['repair_status']), fontSize: 10, fontWeight: FontWeight.bold)),
                  ),
                ],
              ),
              const Divider(color: Colors.white10, height: 24),
              Row(
                children: [
                  const Icon(Icons.build, color: AppColors.gold, size: 16),
                  const SizedBox(width: 8),
                  Text('${r['repair_type']} - ${r['frame_details']}', style: const TextStyle(color: Colors.white, fontSize: 14)),
                ],
              ),
              const SizedBox(height: 12),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      const Icon(Icons.event, color: AppColors.textGray, size: 14),
                      const SizedBox(width: 4),
                      Text('Exp: ${r['expected_date']?.toString().split('T')[0] ?? '-'}', style: const TextStyle(color: AppColors.textGray, fontSize: 12)),
                    ],
                  ),
                  Text('₹${r['charges']}', style: const TextStyle(color: Colors.greenAccent, fontWeight: FontWeight.bold, fontSize: 16)),
                ],
              ),
              if (!isDelivered) ...[
                const SizedBox(height: 16),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: () => _updateStatus(r['id'], nextStatus),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: _getStatusColor(nextStatus).withOpacity(0.2),
                      foregroundColor: _getStatusColor(nextStatus),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                    child: Text('Mark as $nextStatus', style: const TextStyle(fontWeight: FontWeight.bold)),
                  ),
                ),
              ],
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
            const Text('New Repair Order', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 18)),
            const SizedBox(height: 24),
            _inputField(_nameCtrl, 'Customer Name', Icons.person),
            const SizedBox(height: 16),
            _inputField(_mobileCtrl, 'Mobile Number', Icons.phone, keyboardType: TextInputType.phone, maxLength: 10),
            const SizedBox(height: 16),
            _inputField(_frameCtrl, 'Frame Details', Icons.glasses),
            const SizedBox(height: 16),
            _inputField(_typeCtrl, 'Repair Type (e.g. Soldering, Screw)', Icons.build),
            const SizedBox(height: 16),
            _inputField(_chargesCtrl, 'Charges (₹)', Icons.currency_rupee, keyboardType: TextInputType.number),
            const SizedBox(height: 16),
            TextField(
              controller: _dateCtrl,
              readOnly: true,
              style: const TextStyle(color: Colors.white),
              decoration: InputDecoration(
                labelText: 'Expected Delivery Date',
                labelStyle: const TextStyle(color: AppColors.textGray),
                prefixIcon: const Icon(Icons.calendar_today, color: Colors.grey, size: 18),
                filled: true,
                fillColor: Colors.black12,
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: BorderSide.none),
              ),
              onTap: () async {
                final date = await showDatePicker(
                  context: context,
                  initialDate: DateTime.now().add(const Duration(days: 1)),
                  firstDate: DateTime.now(),
                  lastDate: DateTime.now().add(const Duration(days: 365)),
                );
                if (date != null) {
                  setState(() {
                    _dateCtrl.text = date.toIso8601String().split('T')[0];
                  });
                }
              },
            ),
            const SizedBox(height: 24),
            ElevatedButton(
              onPressed: _isSaving ? null : _saveRepair,
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.gold,
                padding: const EdgeInsets.symmetric(vertical: 16),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              child: _isSaving 
                  ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(color: AppColors.darkBg, strokeWidth: 2))
                  : const Text('Create Repair Order', style: TextStyle(color: AppColors.darkBg, fontWeight: FontWeight.bold, fontSize: 16)),
            ),
          ],
        ),
      ),
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
