import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter/foundation.dart';
import '../auth/auth_provider.dart';

final apiProvider = Provider<Dio>((ref) {
  final dio = Dio(BaseOptions(
    baseUrl: kIsWeb ? 'http://localhost:5000/api/v1' : 'http://10.0.2.2:5000/api/v1',
    connectTimeout: const Duration(seconds: 10),
    receiveTimeout: const Duration(seconds: 10),
  ));

  dio.interceptors.add(InterceptorsWrapper(
    onRequest: (options, handler) async {
      final authState = ref.read(authProvider);
      if (authState.token != null) {
        options.headers['Authorization'] = 'Bearer ${authState.token}';
      }
      return handler.next(options);
    },
    onError: (DioException e, handler) {
      if (e.response?.statusCode == 401) {
        // Auto-logout on 401
        ref.read(authProvider.notifier).logout();
      }
      return handler.next(e);
    },
  ));

  return dio;
});
