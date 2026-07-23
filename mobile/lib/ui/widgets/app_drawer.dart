import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/auth/auth_provider.dart';
import '../theme/app_colors.dart';
import '../eyetest/eye_test_screen.dart';

// Since some screens are not yet using GoRouter, we can use Navigator.push for them.
import '../dashboard/dashboard_screen.dart';
import '../billing/new_bill_screen.dart';
import '../sunglasses/sunglasses_billing_screen.dart';
import '../customers/customers_screen.dart';
import '../referrals/referrals_screen.dart';
import '../repairs/repairs_screen.dart';
import '../inventory/inventory_screen.dart';
import '../reports/reports_screen.dart';
import '../settings/settings_screen.dart';

class AppDrawer extends ConsumerWidget {
  const AppDrawer({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authState = ref.watch(authProvider);
    final user = authState.user;
    final isOwner = user?['role'] == 'OWNER';

    return Drawer(
      backgroundColor: AppColors.darkSurface,
      child: Column(
        children: [
          Container(
            padding: const EdgeInsets.symmetric(vertical: 40, horizontal: 24),
            decoration: const BoxDecoration(
              border: Border(bottom: BorderSide(color: Colors.white10)),
            ),
            child: Row(
              children: [
                Container(
                  width: 48,
                  height: 48,
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                      colors: [AppColors.gold, Color(0xFFFFE082)],
                      begin: Alignment.topRight,
                      end: Alignment.bottomLeft,
                    ),
                    borderRadius: BorderRadius.circular(12),
                    boxShadow: [BoxShadow(color: AppColors.gold.withOpacity(0.2), blurRadius: 10)],
                  ),
                  alignment: Alignment.center,
                  child: const Text('EV', style: TextStyle(color: AppColors.darkBg, fontWeight: FontWeight.bold, fontSize: 20)),
                ),
                const SizedBox(width: 16),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: const [
                    Text('EYEVENGERS', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w900, fontSize: 16, letterSpacing: 1.2)),
                    Text('Store POS v1.0', style: TextStyle(color: AppColors.gold, fontWeight: FontWeight.bold, fontSize: 10, letterSpacing: 1.5)),
                  ],
                ),
              ],
            ),
          ),
          
          Expanded(
            child: ListView(
              padding: const EdgeInsets.all(16),
              children: [
                _buildDrawerItem(
                  context, 
                  icon: Icons.dashboard, 
                  title: 'Dashboard', 
                  onTap: () => Navigator.pushReplacement(context, MaterialPageRoute(builder: (_) => const DashboardScreen())),
                ),
                _buildDrawerItem(
                  context, 
                  icon: Icons.receipt_long, 
                  title: 'New Bill', 
                  onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const NewBillScreen())),
                ),
                _buildDrawerItem(
                  context, 
                  icon: Icons.people, 
                  title: 'Customers', 
                  onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const CustomersScreen())),
                ),
                _buildDrawerItem(
                  context, 
                  icon: Icons.card_giftcard, 
                  title: 'Referrals', 
                  onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const ReferralsScreen())),
                ),
                _buildDrawerItem(
                  context, 
                  icon: Icons.inventory_2, 
                  title: 'Products & Inventory', 
                  onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const InventoryScreen())),
                ),
                _buildDrawerItem(
                  context, 
                  icon: Icons.remove_red_eye, 
                  title: 'Eye Test', 
                  onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const EyeTestScreen())),
                ),
                _buildDrawerItem(
                  context, 
                  icon: Icons.build, 
                  title: 'Repair Orders', 
                  onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const RepairsScreen())),
                ),
                _buildDrawerItem(
                  context, 
                  icon: Icons.wb_sunny, 
                  title: 'Sunglasses Billing', 
                  onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const SunglassesBillingScreen())),
                ),
                _buildDrawerItem(
                  context, 
                  icon: Icons.insert_chart, 
                  title: 'Reports', 
                  onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const ReportsScreen())),
                ),
                if (isOwner)
                  _buildDrawerItem(
                    context, 
                    icon: Icons.settings, 
                    title: 'Settings', 
                    onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const SettingsScreen())),
                  ),
              ],
            ),
          ),
          
          Container(
            padding: const EdgeInsets.all(16),
            decoration: const BoxDecoration(
              border: Border(top: BorderSide(color: Colors.white10)),
              color: Colors.black12,
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: [
                    CircleAvatar(
                      backgroundColor: Colors.white10,
                      radius: 18,
                      child: Text(
                        user?['name']?.isNotEmpty == true ? user!['name'][0].toUpperCase() : 'U',
                        style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(user?['name'] ?? 'User', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14)),
                        Text(user?['role'] ?? 'Employee', style: const TextStyle(color: AppColors.textGray, fontSize: 12)),
                      ],
                    ),
                  ],
                ),
                IconButton(
                  icon: const Icon(Icons.logout, color: Colors.redAccent),
                  onPressed: () {
                    ref.read(authProvider.notifier).logout();
                    context.go('/login');
                  },
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDrawerItem(BuildContext context, {required IconData icon, required String title, required VoidCallback onTap}) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8.0),
      child: ListTile(
        leading: Icon(icon, color: Colors.grey.shade400, size: 20),
        title: Text(title, style: const TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.w500)),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        onTap: () {
          Navigator.pop(context); // Close drawer
          onTap();
        },
        hoverColor: Colors.white10,
      ),
    );
  }
}
