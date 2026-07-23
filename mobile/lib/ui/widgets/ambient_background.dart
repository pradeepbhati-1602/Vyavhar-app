import 'package:flutter/material.dart';
import '../theme/app_colors.dart';

class AmbientBackground extends StatelessWidget {
  final Widget child;

  const AmbientBackground({Key? key, required this.child}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        // Background color
        Container(color: AppColors.darkBg),
        
        // Gold glowing orb (top left)
        Positioned(
          top: MediaQuery.of(context).size.height * 0.15,
          left: -100,
          child: Container(
            width: 384, // 96 * 4
            height: 384,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              gradient: RadialGradient(
                colors: [
                  AppColors.gold.withOpacity(0.08),
                  AppColors.gold.withOpacity(0.0),
                ],
                stops: const [0.0, 1.0],
              ),
            ),
          ),
        ),
        
        // Electric Blue glowing orb (bottom right)
        Positioned(
          bottom: MediaQuery.of(context).size.height * 0.15,
          right: -100,
          child: Container(
            width: 384,
            height: 384,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              gradient: RadialGradient(
                colors: [
                  AppColors.electric.withOpacity(0.08),
                  AppColors.electric.withOpacity(0.0),
                ],
                stops: const [0.0, 1.0],
              ),
            ),
          ),
        ),
        
        // The actual content (safe area)
        SafeArea(child: child),
      ],
    );
  }
}
