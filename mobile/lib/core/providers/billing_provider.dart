import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:dio/dio.dart';
import '../../core/network/api_client.dart';
import '../../core/auth/auth_provider.dart';

class BillingState {
  final Map<String, dynamic>? customer;
  final List<Map<String, dynamic>> products;
  final bool isLoading;
  final String? error;

  BillingState({
    this.customer,
    this.products = const [],
    this.isLoading = false,
    this.error,
  });

  BillingState copyWith({
    Map<String, dynamic>? customer,
    List<Map<String, dynamic>>? products,
    bool? isLoading,
    String? error,
    bool clearError = false,
  }) {
    return BillingState(
      customer: customer ?? this.customer,
      products: products ?? this.products,
      isLoading: isLoading ?? this.isLoading,
      error: clearError ? null : (error ?? this.error),
    );
  }
}

class BillingNotifier extends Notifier<BillingState> {
  @override
  BillingState build() {
    return BillingState();
  }

  Future<void> lookupCustomer(String mobile) async {
    if (mobile.length != 10) return;
    
    state = state.copyWith(isLoading: true, clearError: true);
    try {
      final dio = ref.read(apiProvider);
      final response = await dio.get('/customers/lookup/$mobile');
      state = state.copyWith(customer: response.data, isLoading: false);
    } on DioException catch (e) {
      if (e.response?.statusCode == 404) {
        state = state.copyWith(customer: {'mobile': mobile, 'is_new': true}, isLoading: false);
      } else {
        state = state.copyWith(error: 'Failed to lookup customer', isLoading: false);
      }
    }
  }

  Future<void> scanBarcode(String barcode) async {
    state = state.copyWith(isLoading: true, clearError: true);
    try {
      final authState = ref.read(authProvider);
      final dio = ref.read(apiProvider);
      final response = await dio.get('/products/barcode/$barcode?store_id=${authState.storeId ?? ""}');
      
      final product = response.data;
      final existingIndex = state.products.indexWhere((p) => p['id'] == product['id']);
      
      final newProducts = List<Map<String, dynamic>>.from(state.products);
      if (existingIndex >= 0) {
        newProducts[existingIndex]['quantity'] += 1;
      } else {
        newProducts.add({...product, 'quantity': 1});
      }
      
      state = state.copyWith(products: newProducts, isLoading: false);
    } catch (e) {
      state = state.copyWith(error: 'Product not found', isLoading: false);
    }
  }

  void removeProduct(int index) {
    final newProducts = List<Map<String, dynamic>>.from(state.products);
    newProducts.removeAt(index);
    state = state.copyWith(products: newProducts);
  }

  void updateCustomerName(String name) {
    if (state.customer != null) {
      state = state.copyWith(
        customer: {...state.customer!, 'name': name},
      );
    }
  }

  void clear() {
    state = BillingState();
  }

  Future<Map<String, dynamic>?> saveBill(Map<String, dynamic> powerDetails, Map<String, dynamic> financials) async {
    state = state.copyWith(isLoading: true, clearError: true);
    try {
      final authState = ref.read(authProvider);
      final dio = ref.read(apiProvider);
      
      final payload = {
        'customer_name': state.customer?['name'] ?? '',
        'mobile': state.customer?['mobile'] ?? '',
        'items': state.products.map((p) => {
          'product_id': p['id'],
          'qty': p['quantity'],
          'price': p['selling_price'],
          'category': p['category'],
        }).toList(),
        'power': powerDetails,
        'discount': financials['discount'] ?? 0,
        'advance': financials['advance_paid'] ?? 0,
        'cashback_used': financials['cashback_used'] ?? 0,
        'referral_code': state.customer?['referral_code'],
      };

      final response = await dio.post('/bills', data: payload);
      state = state.copyWith(isLoading: false);
      return response.data as Map<String, dynamic>;
    } catch (e) {
      state = state.copyWith(error: 'Failed to save bill: $e', isLoading: false);
      return null;
    }
  }
}

final billingProvider = NotifierProvider<BillingNotifier, BillingState>(() {
  return BillingNotifier();
});
