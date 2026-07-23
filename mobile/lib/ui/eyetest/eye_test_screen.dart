import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/network/api_client.dart';
import '../theme/app_colors.dart';
import 'package:url_launcher/url_launcher.dart';

class EyeTestScreen extends ConsumerStatefulWidget {
  const EyeTestScreen({Key? key}) : super(key: key);

  @override
  ConsumerState<EyeTestScreen> createState() => _EyeTestScreenState();
}

class _EyeTestScreenState extends ConsumerState<EyeTestScreen> {
  bool _isLoading = false;
  List<dynamic> _tests = [];
  
  // Form controllers
  final _nameCtrl = TextEditingController();
  final _mobileCtrl = TextEditingController();
  final _ageCtrl = TextEditingController();
  final _notesCtrl = TextEditingController();
  
  String _visionCategory = 'Distance';
  
  final Map<String, String> _power = {
    're_sph': '0.00', 're_cyl': '0.00', 're_axis': '',
    'le_sph': '0.00', 'le_cyl': '0.00', 'le_axis': '',
    'pd': '', 'add': ''
  };

  @override
  void initState() {
    super.initState();
    _fetchTests();
  }

  Future<void> _fetchTests() async {
    try {
      final dio = ref.read(apiProvider);
      final res = await dio.get('/v1/eyetests'); // Using v1 endpoint if updated, or old endpoint
      setState(() {
        _tests = res.data;
      });
    } catch (e) {
      debugPrint('Failed to load eye tests: $e');
      // If /v1/eyetests 404s, try the old endpoint as fallback during transition
      try {
        final dio = ref.read(apiProvider);
        final res = await dio.get('/eyetests');
        setState(() {
          _tests = res.data;
        });
      } catch (e2) {
        debugPrint('Fallback failed: $e2');
      }
    }
  }

  Future<void> _saveTest() async {
    if (_nameCtrl.text.isEmpty || _mobileCtrl.text.length != 10) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please enter valid name and 10-digit mobile'))
      );
      return;
    }

    setState(() => _isLoading = true);
    try {
      final payload = {
        'patient_name': _nameCtrl.text,
        'mobile': _mobileCtrl.text,
        'age': int.tryParse(_ageCtrl.text),
        'vision_category': _visionCategory,
        're_sph': double.tryParse(_power['re_sph']!) ?? 0,
        're_cyl': double.tryParse(_power['re_cyl']!) ?? 0,
        're_axis': int.tryParse(_power['re_axis']!),
        'le_sph': double.tryParse(_power['le_sph']!) ?? 0,
        'le_cyl': double.tryParse(_power['le_cyl']!) ?? 0,
        'le_axis': int.tryParse(_power['le_axis']!),
        'pd': double.tryParse(_power['pd']!),
        'add_power': double.tryParse(_power['add']!),
        'doctor_notes': _notesCtrl.text
      };

      final dio = ref.read(apiProvider);
      
      // Try v1 first, fallback to old
      dynamic res;
      try {
        res = await dio.post('/v1/eyetests', data: payload);
      } catch (e) {
        res = await dio.post('/eyetests', data: payload);
      }

      final data = res.data;
      
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(data['toast'] ?? 'Prescription Saved!'))
      );
      
      if (data['pdfUrl'] != null) {
        final uri = Uri.parse(data['pdfUrl']);
        if (await canLaunchUrl(uri)) {
          await launchUrl(uri);
        }
      }
      
      _nameCtrl.clear();
      _mobileCtrl.clear();
      _ageCtrl.clear();
      _notesCtrl.clear();
      
      await _fetchTests();
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Error saving test: $e'))
      );
    } finally {
      setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.darkBg,
      appBar: AppBar(
        title: const Text('Eye Testing & Refraction', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
        backgroundColor: AppColors.darkSurface,
        iconTheme: const IconThemeData(color: Colors.white),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Text(
              'Capture clinical measurements, output clinical prescriptions, and push direct checkouts.',
              style: TextStyle(color: AppColors.textGray, fontSize: 12),
            ),
            const SizedBox(height: 24),
            
            // FORM SECTION
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: AppColors.darkSurface.withOpacity(0.5),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: Colors.white.withOpacity(0.05)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(
                    children: const [
                      Icon(Icons.remove_red_eye, color: AppColors.gold, size: 20),
                      SizedBox(width: 8),
                      Text('Optometry Measurement Input', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16)),
                    ],
                  ),
                  const Divider(color: Colors.white10, height: 24),
                  
                  TextField(
                    controller: _nameCtrl,
                    style: const TextStyle(color: Colors.white),
                    decoration: InputDecoration(
                      labelText: 'Patient Name *',
                      labelStyle: const TextStyle(color: AppColors.textGray),
                      prefixIcon: const Icon(Icons.person, color: Colors.grey, size: 18),
                      filled: true,
                      fillColor: Colors.black12,
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: BorderSide.none),
                    ),
                  ),
                  const SizedBox(height: 12),
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
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: TextField(
                          controller: _ageCtrl,
                          keyboardType: TextInputType.number,
                          style: const TextStyle(color: Colors.white),
                          decoration: InputDecoration(
                            labelText: 'Age',
                            labelStyle: const TextStyle(color: AppColors.textGray),
                            filled: true,
                            fillColor: Colors.black12,
                            border: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: BorderSide.none),
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: DropdownButtonFormField<String>(
                          value: _visionCategory,
                          dropdownColor: AppColors.darkSurface,
                          style: const TextStyle(color: Colors.white),
                          decoration: InputDecoration(
                            labelText: 'Vision',
                            labelStyle: const TextStyle(color: AppColors.textGray),
                            filled: true,
                            fillColor: Colors.black12,
                            border: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: BorderSide.none),
                          ),
                          items: ['Distance', 'Reading', 'Progressive', 'Bifocal'].map((String v) {
                            return DropdownMenuItem<String>(value: v, child: Text(v));
                          }).toList(),
                          onChanged: (val) => setState(() => _visionCategory = val!),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 24),
                  
                  const Text('REFRACTION POWERS LEDGER', style: TextStyle(color: AppColors.gold, fontWeight: FontWeight.w900, fontSize: 12, letterSpacing: 1.2)),
                  const SizedBox(height: 12),
                  
                  _buildPowerRow('RE (OD)', 're'),
                  const SizedBox(height: 12),
                  _buildPowerRow('LE (OS)', 'le'),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(child: _powerInput('ADD', 'add', isMisc: true)),
                      const SizedBox(width: 8),
                      Expanded(child: _powerInput('PD (mm)', 'pd', isMisc: true)),
                    ],
                  ),
                  
                  const SizedBox(height: 24),
                  TextField(
                    controller: _notesCtrl,
                    maxLines: 3,
                    style: const TextStyle(color: Colors.white),
                    decoration: InputDecoration(
                      labelText: 'Doctor Clinical Notes',
                      labelStyle: const TextStyle(color: AppColors.textGray),
                      filled: true,
                      fillColor: Colors.black12,
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: BorderSide.none),
                    ),
                  ),
                  const SizedBox(height: 24),
                  
                  ElevatedButton.icon(
                    onPressed: _isLoading ? null : _saveTest,
                    icon: _isLoading 
                        ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(color: AppColors.darkBg, strokeWidth: 2))
                        : const Icon(Icons.description, color: AppColors.darkBg),
                    label: const Text('Save Diagnostic Prescription', style: TextStyle(color: AppColors.darkBg, fontWeight: FontWeight.bold, fontSize: 16)),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.gold,
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                  ),
                ],
              ),
            ),
            
            const SizedBox(height: 24),
            
            // LOGS SECTION
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: AppColors.darkSurface.withOpacity(0.5),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: Colors.white.withOpacity(0.05)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(
                    children: const [
                      Icon(Icons.history, color: AppColors.gold, size: 20),
                      SizedBox(width: 8),
                      Text('Prescription History Logs', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16)),
                    ],
                  ),
                  const Divider(color: Colors.white10, height: 24),
                  
                  if (_tests.isEmpty)
                    const Padding(
                      padding: EdgeInsets.symmetric(vertical: 32.0),
                      child: Center(child: Text('No diagnostic history available.', style: TextStyle(color: AppColors.textGray))),
                    )
                  else
                    ListView.separated(
                      shrinkWrap: true,
                      physics: const NeverScrollableScrollPhysics(),
                      itemCount: _tests.length,
                      separatorBuilder: (c, i) => const SizedBox(height: 12),
                      itemBuilder: (c, i) {
                        final test = _tests[i];
                        return Container(
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: Colors.black12,
                            border: Border.all(color: Colors.white10),
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(test['patient_name'] ?? '', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                                      Text('${test['mobile']} • Age: ${test['age'] ?? '-'}', style: const TextStyle(color: Colors.grey, fontSize: 11, fontFamily: 'monospace')),
                                    ],
                                  ),
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                    decoration: BoxDecoration(
                                      border: Border.all(color: Colors.white10),
                                      borderRadius: BorderRadius.circular(4),
                                    ),
                                    child: Text(
                                      (test['vision_category'] ?? '').toUpperCase(),
                                      style: const TextStyle(color: Colors.grey, fontSize: 9, fontWeight: FontWeight.bold),
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 8),
                              Container(
                                padding: const EdgeInsets.all(8),
                                decoration: BoxDecoration(color: Colors.white.withOpacity(0.05), borderRadius: BorderRadius.circular(8)),
                                child: Row(
                                  mainAxisAlignment: MainAxisAlignment.spaceAround,
                                  children: [
                                    Text('RE: ${test['re_sph']}/${test['re_cyl']}', style: const TextStyle(color: Colors.white, fontSize: 11, fontFamily: 'monospace')),
                                    Text('LE: ${test['le_sph']}/${test['le_cyl']}', style: const TextStyle(color: Colors.white, fontSize: 11, fontFamily: 'monospace')),
                                  ],
                                ),
                              ),
                              const SizedBox(height: 12),
                              Row(
                                children: [
                                  Expanded(
                                    child: ElevatedButton.icon(
                                      onPressed: () {
                                        // TODO: Convert to bill
                                      },
                                      icon: const Icon(Icons.receipt, color: AppColors.darkBg, size: 14),
                                      label: const Text('Convert to Bill', style: TextStyle(color: AppColors.darkBg, fontSize: 11, fontWeight: FontWeight.bold)),
                                      style: ElevatedButton.styleFrom(
                                        backgroundColor: AppColors.gold,
                                        padding: const EdgeInsets.symmetric(vertical: 8),
                                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                                      ),
                                    ),
                                  ),
                                  if (test['prescription_pdf_url'] != null) ...[
                                    const SizedBox(width: 8),
                                    IconButton(
                                      icon: const Icon(Icons.open_in_new, color: Colors.grey, size: 18),
                                      onPressed: () async {
                                        final uri = Uri.parse(test['prescription_pdf_url']);
                                        if (await canLaunchUrl(uri)) {
                                          await launchUrl(uri);
                                        }
                                      },
                                      style: IconButton.styleFrom(
                                        backgroundColor: Colors.white10,
                                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                                      ),
                                    )
                                  ]
                                ],
                              )
                            ],
                          ),
                        );
                      }
                    )
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPowerRow(String label, String prefix) {
    return Row(
      children: [
        SizedBox(
          width: 50,
          child: Text(label, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 11)),
        ),
        const SizedBox(width: 8),
        Expanded(child: _powerInput('SPH', '${prefix}_sph')),
        const SizedBox(width: 8),
        Expanded(child: _powerInput('CYL', '${prefix}_cyl')),
        const SizedBox(width: 8),
        Expanded(child: _powerInput('AXIS', '${prefix}_axis')),
      ],
    );
  }

  Widget _powerInput(String label, String key, {bool isMisc = false}) {
    return TextFormField(
      initialValue: _power[key],
      onChanged: (val) => _power[key] = val,
      style: const TextStyle(color: Colors.white, fontSize: 12),
      decoration: InputDecoration(
        labelText: label,
        labelStyle: const TextStyle(color: AppColors.textGray, fontSize: 10),
        filled: true,
        fillColor: Colors.black12,
        isDense: true,
        contentPadding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(6), borderSide: BorderSide.none),
      ),
    );
  }
}
