import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../core/network/api_client.dart';
import '../../core/auth/auth_provider.dart';

class SettingsScreen extends ConsumerStatefulWidget {
  const SettingsScreen({Key? key}) : super(key: key);

  @override
  ConsumerState<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends ConsumerState<SettingsScreen> {
  final _nameController = TextEditingController();
  final _addressController = TextEditingController();
  final _phoneController = TextEditingController();
  
  bool _isLoading = true;
  bool _isSaving = false;
  
  // Local preferences
  bool _autoWhatsApp = true;
  bool _darkMode = true;
  String _printerType = 'Bluetooth POS';

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    try {
      // Load local prefs
      final prefs = await SharedPreferences.getInstance();
      setState(() {
        _autoWhatsApp = prefs.getBool('autoWhatsApp') ?? true;
        _darkMode = prefs.getBool('darkMode') ?? true;
        _printerType = prefs.getString('printerType') ?? 'Bluetooth POS';
      });

      // Load remote profile
      final dio = ref.read(apiProvider);
      final response = await dio.get('/tenant/profile');
      final profile = response.data;
      
      _nameController.text = profile['business_name'] ?? '';
      _addressController.text = profile['address'] ?? '';
      _phoneController.text = profile['contact_phone'] ?? '';
      
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Failed to load profile')));
    } finally {
      setState(() => _isLoading = false);
    }
  }

  Future<void> _saveLocalPref(String key, dynamic value) async {
    final prefs = await SharedPreferences.getInstance();
    if (value is bool) await prefs.setBool(key, value);
    if (value is String) await prefs.setString(key, value);
  }

  Future<void> _saveProfile() async {
    setState(() => _isSaving = true);
    try {
      final dio = ref.read(apiProvider);
      await dio.put('/tenant/profile', data: {
        'business_name': _nameController.text,
        'address': _addressController.text,
        'contact_phone': _phoneController.text,
      });
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Profile saved successfully!')));
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Failed to save profile')));
    } finally {
      if (mounted) setState(() => _isSaving = false);
    }
  }

  void _handleLogout() {
    ref.read(authProvider.notifier).logout();
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    return Scaffold(
      appBar: AppBar(title: const Text('Settings & Profile')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // 1. Shop Profile
            const Text('Shop Profile', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.amber)),
            const SizedBox(height: 16),
            TextField(controller: _nameController, decoration: const InputDecoration(labelText: 'Shop Name')),
            const SizedBox(height: 12),
            TextField(controller: _addressController, decoration: const InputDecoration(labelText: 'Address'), maxLines: 2),
            const SizedBox(height: 12),
            TextField(controller: _phoneController, decoration: const InputDecoration(labelText: 'Contact Number')),
            const SizedBox(height: 16),
            ElevatedButton(
              onPressed: _isSaving ? null : _saveProfile,
              child: _isSaving ? const CircularProgressIndicator() : const Text('Update Profile'),
            ),
            
            const Divider(height: 48),

            // 2. Local Preferences
            const Text('App Preferences', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.amber)),
            const SizedBox(height: 8),
            SwitchListTile(
              title: const Text('Auto-Send WhatsApp Receipts'),
              subtitle: const Text('Automatically message customers upon billing'),
              value: _autoWhatsApp,
              onChanged: (val) {
                setState(() => _autoWhatsApp = val);
                _saveLocalPref('autoWhatsApp', val);
              },
            ),
            SwitchListTile(
              title: const Text('Dark Mode'),
              value: _darkMode,
              onChanged: (val) {
                setState(() => _darkMode = val);
                _saveLocalPref('darkMode', val);
                // In a full app, this would trigger a Riverpod ThemeProvider update
              },
            ),
            
            const Divider(height: 48),

            // 3. Hardware Integration
            const Text('Hardware Integration', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.amber)),
            const SizedBox(height: 16),
            DropdownButtonFormField<String>(
              decoration: const InputDecoration(labelText: 'Default Printer'),
              value: _printerType,
              items: ['Bluetooth POS', 'USB Desktop Printer', 'Network (Wi-Fi)'].map((p) => DropdownMenuItem(value: p, child: Text(p))).toList(),
              onChanged: (val) {
                if (val != null) {
                  setState(() => _printerType = val);
                  _saveLocalPref('printerType', val);
                }
              },
            ),

            const SizedBox(height: 48),
            
            // 4. Logout
            OutlinedButton.icon(
              icon: const Icon(Icons.logout, color: Colors.redAccent),
              label: const Text('Log Out', style: TextStyle(color: Colors.redAccent)),
              style: OutlinedButton.styleFrom(
                side: const BorderSide(color: Colors.redAccent),
                padding: const EdgeInsets.symmetric(vertical: 16)
              ),
              onPressed: _handleLogout,
            )
          ],
        ),
      ),
    );
  }
}
