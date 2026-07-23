import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/auth/auth_provider.dart';
import '../../core/providers/tenant_provider.dart';
import '../../core/providers/dashboard_provider.dart';
import '../billing/new_bill_screen.dart';
import 'undelivered_orders_screen.dart';
import '../customers/sell_membership_screen.dart';
import '../settings/settings_screen.dart';
import '../widgets/metric_card.dart';
import '../widgets/app_drawer.dart';
import '../theme/app_colors.dart';

class DashboardScreen extends ConsumerStatefulWidget {
  const DashboardScreen({Key? key}) : super(key: key);

  @override
  ConsumerState<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends ConsumerState<DashboardScreen> {
  String _selectedStore = 'ALL';

  @override
  void initState() {
    super.initState();
    // Fetch initial data
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(dashboardProvider.notifier).fetchDashboard();
    });
  }

  @override
  Widget build(BuildContext context) {
    final tenantData = ref.watch(tenantProvider);
    final dashboardState = ref.watch(dashboardProvider);
    final authState = ref.watch(authProvider);

    final userName = authState.token != null ? "User" : "User"; // Could extract from token or state if available

    return Scaffold(
      backgroundColor: AppColors.darkBg,
      drawer: const AppDrawer(),
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: () => ref.read(dashboardProvider.notifier).fetchDashboard(),
          color: AppColors.gold,
          backgroundColor: const Color(0xFF1A1D24),
          child: dashboardState.when(
            loading: () => const Center(child: CircularProgressIndicator(color: AppColors.gold)),
            error: (err, stack) => _buildErrorState(err),
            data: (data) {
              final metrics = data;
              return SingleChildScrollView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.all(24.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    // Header Section
                    _buildHeader(tenantData, metrics.stores),
                    const SizedBox(height: 8),
                    Text(
                      'Welcome Back',
                      style: const TextStyle(
                        fontSize: 28,
                        fontWeight: FontWeight.w900,
                        color: Colors.white,
                        letterSpacing: 0.5,
                      ),
                    ),
                    const SizedBox(height: 4),
                    const Text(
                      'Here is how your store is performing today.',
                      style: TextStyle(
                        color: AppColors.textGray,
                        fontSize: 14,
                      ),
                    ),
                    const SizedBox(height: 32),

                    // Metrics Grid (6 cards)
                    GridView.count(
                      shrinkWrap: true,
                      physics: const NeverScrollableScrollPhysics(),
                      crossAxisCount: MediaQuery.of(context).size.width > 800 ? 6 : (MediaQuery.of(context).size.width > 500 ? 3 : 2),
                      crossAxisSpacing: 16,
                      mainAxisSpacing: 16,
                      childAspectRatio: 0.85,
                      children: [
                        MetricCard(
                          title: "Today's Revenue",
                          value: "₹${metrics.today['revenue']}",
                          subtitle: "${metrics.today['bills']} bills generated",
                          tag: "Today",
                          icon: Icons.account_balance_wallet,
                          themeColor: AppColors.gold,
                        ),
                        MetricCard(
                          title: "Monthly Revenue",
                          value: "₹${metrics.monthly['revenue']}",
                          subtitle: "${metrics.monthly['bills']} transactions",
                          tag: "This Month",
                          icon: Icons.trending_up,
                          themeColor: Colors.blueAccent,
                        ),
                        MetricCard(
                          title: "Total Customers",
                          value: "${metrics.overall['customers']}",
                          subtitle: "Overall database size",
                          tag: "Overall",
                          icon: Icons.people,
                          themeColor: Colors.grey.shade400,
                        ),
                        MetricCard(
                          title: "Average Bill",
                          value: "₹${metrics.overall['bills'] > 0 ? (metrics.overall['revenue'] / metrics.overall['bills']).round() : 0}",
                          subtitle: "From ${metrics.overall['bills']} overall bills",
                          tag: "Ticket Size",
                          icon: Icons.receipt,
                          themeColor: Colors.grey.shade400,
                        ),
                        MetricCard(
                          title: "Amount Due",
                          value: "₹${metrics.alerts['due_customers'] * 500}", // Mock calculation for amount if not provided
                          subtitle: "${metrics.alerts['due_customers']} accounts outstanding",
                          tag: "Pending Dues",
                          icon: Icons.money_off,
                          themeColor: Colors.redAccent,
                          isAlert: true,
                          onTap: () {
                            // Show Dues Modal
                          },
                        ),
                        MetricCard(
                          title: "Expiring 30 Days",
                          value: "0", // Mock for warranties until added to API
                          subtitle: "Click to view expirations",
                          tag: "Warranties",
                          icon: Icons.security,
                          themeColor: AppColors.gold,
                          onTap: () {
                            // Show Warranties
                          },
                        ),
                      ],
                    ),
                    const SizedBox(height: 32),

                    // Actionable Lists Section
                    // Low Stock Alerts
                    if (metrics.alerts['low_stock_items'] > 0)
                      _buildAlertSection(
                        title: "Low Stock Alerts",
                        icon: Icons.warning_amber,
                        color: Colors.redAccent,
                        child: _buildActionList(
                          itemCount: metrics.alerts['low_stock_items'],
                          titleBuilder: (i) => "Item ${i+1} is below threshold",
                          actionLabel: "REORDER",
                          onAction: (i) {},
                        ),
                      ),

                    // Today's Birthdays
                    _buildAlertSection(
                      title: "Today's Birthdays",
                      icon: Icons.cake,
                      color: Colors.pinkAccent,
                      child: metrics.alerts['birthday_customers'] > 0
                          ? _buildActionList(
                              itemCount: metrics.alerts['birthday_customers'],
                              titleBuilder: (i) => "Customer ${i+1}",
                              actionLabel: "WISH",
                              onAction: (i) {},
                            )
                          : _buildEmptyState("No birthdays today", Icons.cake_outlined),
                    ),

                    // Repairs Ready
                    _buildAlertSection(
                      title: "Repairs Ready for Pickup",
                      icon: Icons.build,
                      color: Colors.orangeAccent,
                      child: _buildEmptyState("No repairs pending pickup", Icons.build_circle_outlined),
                    ),

                    // Pending Handovers
                    if (metrics.alerts['undelivered_orders'] > 0)
                      _buildAlertSection(
                        title: "Pending Handovers",
                        icon: Icons.local_shipping,
                        color: Colors.blueAccent,
                        child: _buildActionList(
                          itemCount: metrics.alerts['undelivered_orders'],
                          titleBuilder: (i) => "Invoice #100${i}",
                          subtitleBuilder: (i) => "Spectacles ready for delivery",
                          actionLabel: "DELIVER",
                          onAction: (i) {},
                        ),
                      ),
                      
                    const SizedBox(height: 100), // Padding for bottom nav
                  ],
                ),
              );
            },
          ),
        ),
      ),
    );
  }

  Widget _buildHeader(TenantData tenantData, List<dynamic> stores) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Row(
          children: [
            if (tenantData.shopLogoUrl != null)
              CircleAvatar(
                backgroundImage: NetworkImage(tenantData.shopLogoUrl!),
                radius: 16,
              )
            else
              CircleAvatar(
                backgroundColor: AppColors.gold.withOpacity(0.2),
                radius: 16,
                child: Text(
                  tenantData.businessName.isNotEmpty ? tenantData.businessName[0] : 'E',
                  style: const TextStyle(color: AppColors.gold, fontWeight: FontWeight.bold, fontSize: 14),
                ),
              ),
            const SizedBox(width: 12),
            Text(
              tenantData.businessName,
              style: const TextStyle(
                color: Colors.white,
                fontWeight: FontWeight.bold,
                fontSize: 16,
              ),
            ),
          ],
        ),
        Row(
          children: [
            // Online Terminal Indicator
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(
                color: Colors.greenAccent.withOpacity(0.1),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: Colors.greenAccent.withOpacity(0.3)),
              ),
              child: Row(
                children: [
                  Container(
                    width: 6,
                    height: 6,
                    decoration: const BoxDecoration(
                      color: Colors.greenAccent,
                      shape: BoxShape.circle,
                    ),
                  ),
                  const SizedBox(width: 6),
                  const Text(
                    'Online',
                    style: TextStyle(color: Colors.greenAccent, fontSize: 10, fontWeight: FontWeight.bold),
                  ),
                ],
              ),
            ),
            if (stores.length > 1) ...[
              const SizedBox(width: 12),
              Container(
                height: 32,
                padding: const EdgeInsets.symmetric(horizontal: 8),
                decoration: BoxDecoration(
                  color: Colors.white.withOpacity(0.05),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: Colors.white.withOpacity(0.1)),
                ),
                child: DropdownButtonHideUnderline(
                  child: DropdownButton<String>(
                    value: _selectedStore,
                    dropdownColor: const Color(0xFF1A1D24),
                    icon: const Icon(Icons.arrow_drop_down, color: AppColors.textGray, size: 20),
                    style: const TextStyle(color: Colors.white, fontSize: 12),
                    items: [
                      const DropdownMenuItem(value: 'ALL', child: Text('All Locations')),
                      ...stores.map((s) => DropdownMenuItem(
                        value: s['store_id'],
                        child: Text(s['store_name']),
                      ))
                    ],
                    onChanged: (val) {
                      if (val != null) {
                        setState(() => _selectedStore = val);
                        // Trigger refetch with store filter in provider if implemented
                      }
                    },
                  ),
                ),
              ),
            ],
            const SizedBox(width: 12),
            IconButton(
              icon: const Icon(Icons.settings, color: AppColors.textGray),
              onPressed: () {
                Navigator.push(context, MaterialPageRoute(builder: (_) => const SettingsScreen()));
              },
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildAlertSection({required String title, required IconData icon, required Color color, required Widget child}) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Icon(icon, color: color, size: 20),
            const SizedBox(width: 8),
            Text(
              title,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 18,
                fontWeight: FontWeight.bold,
              ),
            ),
          ],
        ),
        const SizedBox(height: 16),
        child,
        const SizedBox(height: 32),
      ],
    );
  }

  Widget _buildEmptyState(String message, IconData icon) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(vertical: 32),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.02),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: Colors.white.withOpacity(0.05), style: BorderStyle.solid),
      ),
      child: Column(
        children: [
          Icon(icon, color: Colors.white.withOpacity(0.1), size: 48),
          const SizedBox(height: 12),
          Text(message, style: const TextStyle(color: AppColors.textGray, fontSize: 14)),
        ],
      ),
    );
  }

  Widget _buildActionList({
    required int itemCount,
    required String Function(int) titleBuilder,
    String Function(int)? subtitleBuilder,
    required String actionLabel,
    required void Function(int) onAction,
  }) {
    return ListView.separated(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      itemCount: itemCount,
      separatorBuilder: (_, __) => const SizedBox(height: 12),
      itemBuilder: (context, index) {
        return Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: const Color(0xFF14161C),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: Colors.white.withOpacity(0.05)),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      titleBuilder(index),
                      style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
                    ),
                    if (subtitleBuilder != null) ...[
                      const SizedBox(height: 4),
                      Text(
                        subtitleBuilder(index),
                        style: const TextStyle(color: AppColors.textGray, fontSize: 12),
                      ),
                    ]
                  ],
                ),
              ),
              ElevatedButton(
                onPressed: () => onAction(index),
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.gold.withOpacity(0.1),
                  foregroundColor: AppColors.gold,
                  elevation: 0,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                ),
                child: Text(actionLabel, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12)),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildErrorState(Object err) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(Icons.error_outline, color: Colors.redAccent, size: 60),
          const SizedBox(height: 16),
          const Text('Dashboard Load Error', style: TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.bold)),
          const SizedBox(height: 8),
          Text(err.toString(), style: const TextStyle(color: AppColors.textGray)),
          const SizedBox(height: 24),
          ElevatedButton(
            onPressed: () => ref.read(dashboardProvider.notifier).fetchDashboard(),
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.gold, foregroundColor: AppColors.darkBg),
            child: const Text('Try Again'),
          )
        ],
      ),
    );
  }
}
