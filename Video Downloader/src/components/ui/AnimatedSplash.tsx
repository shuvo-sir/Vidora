import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import LottieView from 'lottie-react-native';

type AnimatedSplashProps = {
  onFinish: () => void;
};

export function AnimatedSplash({ onFinish }: AnimatedSplashProps) {
  const [isIntroFinished, setIsIntroFinished] = useState(false);

  useEffect(() => {
    const timeout = setTimeout(onFinish, 2500);
    return () => clearTimeout(timeout);
  }, [onFinish]);

  return (
    <View style={[StyleSheet.absoluteFill, styles.container]}>
      {!isIntroFinished ? (
        <LottieView
          source={require('../../../assets/animations/vidora_splash_intro.json')}
          autoPlay
          loop={false}
          onAnimationFinish={() => setIsIntroFinished(true)}
          style={styles.animation}
          resizeMode="contain"
        />
      ) : (
        <LottieView
          source={require('../../../assets/animations/vidora_splash_pulse.json')}
          autoPlay
          loop
          style={styles.animation}
          resizeMode="contain"
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    zIndex: 999,
  },
  animation: {
    width: 250,
    height: 250,
  },
});
