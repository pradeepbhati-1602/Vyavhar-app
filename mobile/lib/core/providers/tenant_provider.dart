import 'package:flutter_riverpod/flutter_riverpod.dart';

class TenantData {
  final String businessName;
  final String? shopLogoUrl;

  TenantData({
    required this.businessName,
    this.shopLogoUrl,
  });

  factory TenantData.defaultTenant() {
    return TenantData(businessName: 'Eyevengers Optical');
  }
}

class TenantNotifier extends Notifier<TenantData> {
  @override
  TenantData build() {
    return TenantData.defaultTenant();
  }

  void setTenantData(TenantData data) {
    state = data;
  }

  void clear() {
    state = TenantData.defaultTenant();
  }
}

final tenantProvider = NotifierProvider<TenantNotifier, TenantData>(() {
  return TenantNotifier();
});
