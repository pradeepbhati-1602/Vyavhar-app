import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../providers/tenant_provider.dart';

const storage = FlutterSecureStorage();

class AuthState {
  final bool isAuthenticated;
  final String? token;
  final String? role;
  final String? tenantId;
  final String? storeId;

  AuthState({
    this.isAuthenticated = false,
    this.token,
    this.role,
    this.tenantId,
    this.storeId,
  });
}

class AuthNotifier extends Notifier<AuthState> {
  @override
  AuthState build() {
    _loadToken();
    return AuthState();
  }

  Future<void> _loadToken() async {
    final token = await storage.read(key: 'jwt_token');
    final role = await storage.read(key: 'user_role');
    final tenantId = await storage.read(key: 'tenant_id');
    final storeId = await storage.read(key: 'store_id');
    final businessName = await storage.read(key: 'business_name');
    final logoUrl = await storage.read(key: 'shop_logo_url');

    if (token != null) {
      state = AuthState(
        isAuthenticated: true,
        token: token,
        role: role,
        tenantId: tenantId,
        storeId: storeId,
      );
      
      if (businessName != null) {
        ref.read(tenantProvider.notifier).setTenantData(
          TenantData(businessName: businessName, shopLogoUrl: logoUrl)
        );
      }
    }
  }

  Future<void> login(String token, Map<String, dynamic> userData, TenantData tenantData) async {
    await storage.write(key: 'jwt_token', value: token);
    await storage.write(key: 'user_role', value: userData['role']);
    await storage.write(key: 'tenant_id', value: userData['tenant_id']);
    if (userData['store_id'] != null) {
      await storage.write(key: 'store_id', value: userData['store_id']);
    }
    
    await storage.write(key: 'business_name', value: tenantData.businessName);
    if (tenantData.shopLogoUrl != null) {
      await storage.write(key: 'shop_logo_url', value: tenantData.shopLogoUrl);
    }

    state = AuthState(
      isAuthenticated: true,
      token: token,
      role: userData['role'],
      tenantId: userData['tenant_id'],
      storeId: userData['store_id'],
    );
    
    ref.read(tenantProvider.notifier).setTenantData(tenantData);
  }

  Future<void> logout() async {
    await storage.deleteAll();
    state = AuthState();
    ref.read(tenantProvider.notifier).clear();
  }
}

final authProvider = NotifierProvider<AuthNotifier, AuthState>(() {
  return AuthNotifier();
});
