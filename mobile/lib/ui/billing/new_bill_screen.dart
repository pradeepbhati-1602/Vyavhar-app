import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/providers/billing_provider.dart';
import '../../core/auth/auth_provider.dart';
import '../../core/network/api_client.dart';
import '../../utils/whatsapp_launcher.dart';
class NewBillScreen extends ConsumerStatefulWidget {
  final bool isSunglasses;
  const NewBillScreen({Key? key, this.isSunglasses = false}) : super(key: key);

  @override
  ConsumerState<NewBillScreen> createState() => _NewBillScreenState();
}

class _NewBillScreenState extends ConsumerState<NewBillScreen> {
  final _mobileController = TextEditingController();
  final _nameController = TextEditingController();
  final _barcodeController = TextEditingController();

  // Financials
  double _discount = 0.0;
  double _cashbackToUse = 0.0;
  double _advancePaid = 0.0;

  // Power Details
  final Map<String, String> _power = {
    're_sph': '', 're_cyl': '', 're_axis': '', 're_add': '', 're_pd': '',
    'le_sph': '', 'le_cyl': '', 'le_axis': '', 'le_add': '', 'le_pd': '',
  };

  @override
  Widget build(BuildContext context) {
    final billingState = ref.watch(billingProvider);
    final theme = Theme.of(context);

    // Calculate Totals
    double subtotal = 0.0;
    for (var p in billingState.products) {
      subtotal += (double.tryParse(p['selling_price'].toString()) ?? 0.0) * p['quantity'];
    }
    
    double totalAmount = subtotal - _discount - _cashbackToUse;
    if (totalAmount < 0) totalAmount = 0;
    double dueAmount = totalAmount - _advancePaid;
    if (dueAmount < 0) dueAmount = 0;

    return Scaffold(
      appBar: AppBar(
        title: Text(widget.isSunglasses ? 'New Sunglasses Bill' : 'New Optical Bill'),
        actions: [
          IconButton(
            icon: const Icon(Icons.clear),
            onPressed: () {
              ref.read(billingProvider.notifier).clear();
              Navigator.pop(context);
            },
          )
        ],
      ),
      body: billingState.isLoading
          ? const Center(child: CircularProgressIndicator())
          : SingleChildScrollView(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  if (billingState.error != null)
                    Container(
                      color: Colors.red.withValues(alpha: 0.1),
                      padding: const EdgeInsets.all(8),
                      child: Text(billingState.error!, style: const TextStyle(color: Colors.red)),
                    ),
                  
                  // 1. Customer Section
                  _buildSectionHeader('Customer Details'),
                  TextField(
                    controller: _mobileController,
                    keyboardType: TextInputType.phone,
                    decoration: const InputDecoration(
                      labelText: 'Mobile Number',
                      prefixIcon: Icon(Icons.phone),
                    ),
                    onChanged: (val) {
                      if (val.length == 10) {
                        ref.read(billingProvider.notifier).lookupCustomer(val);
                      }
                    },
                  ),
                  const SizedBox(height: 12),
                  if (billingState.customer != null) ...[
                    TextField(
                      controller: _nameController..text = billingState.customer!['name'] ?? '',
                      decoration: const InputDecoration(labelText: 'Customer Name'),
                      onChanged: (val) => ref.read(billingProvider.notifier).updateCustomerName(val),
                    ),
                    const SizedBox(height: 8),
                    if (billingState.customer!['is_new'] != true) ...[
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text('Cashback Balance: ₹${billingState.customer!['current_cashback'] ?? 0}', style: const TextStyle(color: Colors.greenAccent)),
                          Text('Pending Dues: ₹${billingState.customer!['pending_due'] ?? 0}', style: const TextStyle(color: Colors.orangeAccent)),
                        ],
                      )
                    ],
                  ],

                  const Divider(height: 32),

                  // 2. Product Section
                  _buildSectionHeader('Products'),
                  Row(
                    children: [
                      Expanded(
                        child: TextField(
                          controller: _barcodeController,
                          decoration: const InputDecoration(
                            labelText: 'Scan or Enter Barcode',
                            prefixIcon: Icon(Icons.qr_code_scanner),
                          ),
                          onSubmitted: (val) {
                            if (val.isNotEmpty) {
                              ref.read(billingProvider.notifier).scanBarcode(val);
                              _barcodeController.clear();
                            }
                          },
                        ),
                      ),
                      const SizedBox(width: 8),
                      ElevatedButton(
                        onPressed: () {
                          if (_barcodeController.text.isNotEmpty) {
                            ref.read(billingProvider.notifier).scanBarcode(_barcodeController.text);
                            _barcodeController.clear();
                          }
                        },
                        child: const Text('Add'),
                      )
                    ],
                  ),
                  const SizedBox(height: 16),
                  ...billingState.products.asMap().entries.map((e) {
                    final index = e.key;
                    final prod = e.value;
                    return ListTile(
                      title: Text(prod['product_name']),
                      subtitle: Text('Qty: ${prod['quantity']} | Rate: ₹${prod['selling_price']}'),
                      trailing: IconButton(
                        icon: const Icon(Icons.delete, color: Colors.redAccent),
                        onPressed: () => ref.read(billingProvider.notifier).removeProduct(index),
                      ),
                    );
                  }).toList(),

                  const Divider(height: 32),

                  // 3. Power Section (if not sunglasses)
                  if (!widget.isSunglasses) ...[
                    _buildSectionHeader('Eye Power Details'),
                    _buildPowerRow('Right Eye (OD)', 're'),
                    const SizedBox(height: 8),
                    _buildPowerRow('Left Eye (OS)', 'le'),
                    const Divider(height: 32),
                  ],

                  // 4. Financial Section
                  _buildSectionHeader('Financials'),
                  _buildSummaryRow('Subtotal', subtotal),
                  TextField(
                    decoration: const InputDecoration(labelText: 'Discount Amount (₹)'),
                    keyboardType: TextInputType.number,
                    onChanged: (val) => setState(() => _discount = double.tryParse(val) ?? 0.0),
                  ),
                  const SizedBox(height: 8),
                  if (billingState.customer != null && billingState.customer!['current_cashback'] != null)
                    TextField(
                      decoration: InputDecoration(
                        labelText: 'Use Cashback (Max: ₹${billingState.customer!['current_cashback']})'
                      ),
                      keyboardType: TextInputType.number,
                      onChanged: (val) {
                        double v = double.tryParse(val) ?? 0.0;
                        if (v > (double.tryParse(billingState.customer!['current_cashback'].toString()) ?? 0)) {
                          v = double.tryParse(billingState.customer!['current_cashback'].toString()) ?? 0;
                        }
                        setState(() => _cashbackToUse = v);
                      },
                    ),
                  const SizedBox(height: 8),
                  _buildSummaryRow('Total Amount', totalAmount, isBold: true),
                  TextField(
                    decoration: const InputDecoration(labelText: 'Advance Paid (₹)'),
                    keyboardType: TextInputType.number,
                    onChanged: (val) => setState(() => _advancePaid = double.tryParse(val) ?? 0.0),
                  ),
                  const SizedBox(height: 8),
                  _buildSummaryRow('Due Amount', dueAmount, color: Colors.orangeAccent),
                  
                  const SizedBox(height: 32),
                  ElevatedButton(
                    onPressed: () => _handleSave(billingState, subtotal, totalAmount, dueAmount),
                    style: ElevatedButton.styleFrom(padding: const EdgeInsets.symmetric(vertical: 16)),
                    child: const Text('Save & Generate Invoice', style: TextStyle(fontSize: 18)),
                  ),
                  const SizedBox(height: 32),
                ],
              ),
            ),
    );
  }

  Widget _buildSectionHeader(String title) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Text(title, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: Colors.amber)),
    );
  }

  Widget _buildSummaryRow(String label, double amount, {bool isBold = false, Color? color}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8.0),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: TextStyle(fontSize: isBold ? 18 : 16, fontWeight: isBold ? FontWeight.bold : FontWeight.normal)),
          Text('₹${amount.toStringAsFixed(2)}', style: TextStyle(fontSize: isBold ? 18 : 16, fontWeight: FontWeight.bold, color: color)),
        ],
      ),
    );
  }

  Widget _buildPowerRow(String label, String prefix) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: const TextStyle(fontWeight: FontWeight.bold)),
        const SizedBox(height: 8),
        Row(
          children: [
            Expanded(child: _powerInput('SPH', prefix)),
            const SizedBox(width: 4),
            Expanded(child: _powerInput('CYL', prefix)),
            const SizedBox(width: 4),
            Expanded(child: _powerInput('AXIS', prefix)),
          ],
        ),
      ],
    );
  }

  Widget _powerInput(String label, String prefix) {
    return TextField(
      decoration: InputDecoration(labelText: label, isDense: true),
      onChanged: (val) => _power['${prefix}_${label.toLowerCase()}'] = val,
    );
  }

  void _handleSave(BillingState state, double subtotal, double totalAmount, double dueAmount) async {
    if (state.customer == null) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Please enter customer details')));
      return;
    }
    if (state.products.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Please add at least one product')));
      return;
    }

    final financials = {
      'subtotal': subtotal,
      'discount': _discount,
      'cashback_used': _cashbackToUse,
      'advance_paid': _advancePaid,
      'due_amount': dueAmount,
      'total_amount': totalAmount,
      'payment_status': dueAmount > 0 ? 'PARTIAL' : 'PAID',
    };

    final billData = await ref.read(billingProvider.notifier).saveBill(
      widget.isSunglasses ? {} : _power,
      financials,
    );

    if (billData != null && mounted) {
      ref.read(billingProvider.notifier).clear();
      Navigator.pushReplacement(context, MaterialPageRoute(builder: (_) => BillSuccessScreen(billData: billData)));
    }
  }
}

class BillSuccessScreen extends ConsumerStatefulWidget {
  final Map<String, dynamic> billData;
  const BillSuccessScreen({Key? key, required this.billData}) : super(key: key);

  @override
  ConsumerState<BillSuccessScreen> createState() => _BillSuccessScreenState();
}

class _BillSuccessScreenState extends ConsumerState<BillSuccessScreen> {
  bool _isGenerating = false;
  bool _isSending = false;

  Future<void> _generatePdf() async {
    setState(() => _isGenerating = true);
    try {
      final pdfUrl = widget.billData['invoice_pdf_url'];
      if (pdfUrl != null && mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('PDF URL: $pdfUrl')));
      }
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Failed to generate PDF')));
    } finally {
      if (mounted) setState(() => _isGenerating = false);
    }
  }

  Future<void> _sendWhatsApp() async {
    setState(() => _isSending = true);
    try {
      final link = widget.billData['whatsapp_link'];
      if (link != null) {
        await WhatsAppLauncher.launch(link);
      }
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Failed to open WhatsApp')));
    } finally {
      if (mounted) setState(() => _isSending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Icon(Icons.check_circle, color: Colors.greenAccent, size: 100),
              const SizedBox(height: 24),
              const Text('Bill Saved Successfully!', textAlign: TextAlign.center, style: TextStyle(fontSize: 28, fontWeight: FontWeight.bold)),
              const SizedBox(height: 48),
              ElevatedButton.icon(
                icon: _isGenerating ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2)) : const Icon(Icons.picture_as_pdf),
                label: const Text('Generate PDF Invoice'),
                onPressed: _isGenerating ? null : _generatePdf,
                style: ElevatedButton.styleFrom(padding: const EdgeInsets.symmetric(vertical: 16)),
              ),
              const SizedBox(height: 16),
              OutlinedButton.icon(
                icon: _isSending ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2)) : const Icon(Icons.share),
                label: const Text('Share via WhatsApp'),
                onPressed: _isSending ? null : _sendWhatsApp,
                style: OutlinedButton.styleFrom(padding: const EdgeInsets.symmetric(vertical: 16)),
              ),
              const SizedBox(height: 16),
              TextButton(
                onPressed: () => Navigator.pop(context),
                child: const Text('Back to Dashboard'),
              )
            ],
          ),
        ),
      ),
    );
  }
}
