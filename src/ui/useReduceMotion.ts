import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/** OS の「視差効果を減らす／アニメーションを減らす」設定（§11）。オンならアニメーションを止める */
export function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((v) => mounted && setReduce(v));
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);
  return reduce;
}
