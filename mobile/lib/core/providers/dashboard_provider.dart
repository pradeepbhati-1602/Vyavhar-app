import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/network/api_client.dart';

class DashboardData {
  final Map<String, dynamic> today;
  final Map<String, dynamic> monthly;
  final Map<String, dynamic> overall;
  final Map<String, dynamic> alerts;
  final List<dynamic> stores;

  DashboardData({
    required this.today,
    required this.monthly,
    required this.overall,
    required this.alerts,
    required this.stores,
  });

  factory DashboardData.empty() {
    return DashboardData(
      today: {'revenue': 0, 'bills': 0},
      monthly: {'revenue': 0, 'bills': 0},
      overall: {'revenue': 0, 'bills': 0, 'customers': 0},
      alerts: {'due_customers': 0, 'undelivered_orders': 0, 'birthday_customers': 0, 'low_stock_items': 0},
      stores: [],
    );
  }
}

class DashboardNotifier extends Notifier<AsyncValue<DashboardData>> {
  @override
  AsyncValue<DashboardData> build() {
    fetchDashboard();
    return const AsyncValue.loading();
  }

  Future<void> fetchDashboard() async {
    state = const AsyncValue.loading();
    try {
      final dio = ref.read(apiProvider);
      final response = await dio.get('/dashboard/metrics');
      
      final data = DashboardData(
        today: response.data['today'],
        monthly: response.data['monthly'],
        overall: response.data['overall'],
        alerts: response.data['alerts'],
        stores: response.data['stores'] ?? [],
      );
      state = AsyncValue.data(data);
    } catch (e, st) {
      state = AsyncValue.error(e, st);
    }
  }
}

final dashboardProvider = NotifierProvider<DashboardNotifier, AsyncValue<DashboardData>>(() {
  return DashboardNotifier();
});
