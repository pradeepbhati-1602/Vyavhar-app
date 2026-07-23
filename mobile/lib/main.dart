import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'routes/app_router.dart';
import 'ui/theme/app_theme.dart';

void main() {
  runApp(
    const ProviderScope(
      child: EyevengersMobileApp(),
    ),
  );
}

class EyevengersMobileApp extends ConsumerWidget {
  const EyevengersMobileApp({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(routerProvider);

    return MaterialApp.router(
      title: 'Eyevengers Mobile',
      theme: AppTheme.darkTheme, // Applied Dark Theme with Gold Accent
      routerConfig: router,
      debugShowCheckedModeBanner: false,
    );
  }
}
