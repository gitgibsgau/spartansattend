// components/ui/Gradient.js
// Drop-in gradient backed by react-native-svg (already in the dev client via
// react-native-qrcode-svg) so it needs NO native rebuild — unlike
// expo-linear-gradient, which requires recompiling the custom dev client.
//
// API mirrors expo-linear-gradient's <LinearGradient> closely:
//   <LinearGradient colors={[...]} start={{x,y}} end={{x,y}} style={...}>
//
// The SVG is rendered as an absolutely-positioned background sized from the
// container's measured layout (percentage SVG dimensions don't resolve against
// an auto-height parent, which would only paint a partial band).
import React, { useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Defs, LinearGradient as SvgLinearGradient, Stop, Rect } from 'react-native-svg';

let _gid = 0;

export function LinearGradient({
  colors = ['#6366F1', '#8B5CF6'],
  start = { x: 0, y: 0 },
  end = { x: 1, y: 1 },
  style,
  children,
  ...rest
}) {
  // Stable unique gradient id per mounted instance (avoids SVG id collisions).
  const idRef = useRef(null);
  if (idRef.current === null) idRef.current = `grad_${_gid++}`;
  const id = idRef.current;

  const [size, setSize] = useState({ width: 0, height: 0 });

  // Pull any corner-radius off the passed style so the SVG background is
  // clipped to the same rounded shape (otherwise the gradient paints a square).
  const flat = StyleSheet.flatten(style) || {};
  const clipRadius = {
    borderRadius: flat.borderRadius,
    borderTopLeftRadius: flat.borderTopLeftRadius,
    borderTopRightRadius: flat.borderTopRightRadius,
    borderBottomLeftRadius: flat.borderBottomLeftRadius,
    borderBottomRightRadius: flat.borderBottomRightRadius,
  };

  const onLayout = (e) => {
    const { width, height } = e.nativeEvent.layout;
    setSize((prev) =>
      prev.width === width && prev.height === height ? prev : { width, height }
    );
  };

  const stops = colors.map((c, i) => (
    <Stop
      key={i}
      offset={colors.length === 1 ? 1 : i / (colors.length - 1)}
      stopColor={c}
      stopOpacity={1}
    />
  ));

  return (
    // Solid fallback background (first color) keeps RN shadow calc efficient and
    // avoids a one-frame flash before the SVG measures.
    <View style={[{ backgroundColor: colors[0] }, style]} onLayout={onLayout} {...rest}>
      <View style={[StyleSheet.absoluteFill, styles.clip, clipRadius]} pointerEvents="none">
        {size.width > 0 && size.height > 0 && (
          <Svg width={size.width} height={size.height}>
            <Defs>
              <SvgLinearGradient id={id} x1={start.x} y1={start.y} x2={end.x} y2={end.y}>
                {stops}
              </SvgLinearGradient>
            </Defs>
            <Rect x="0" y="0" width={size.width} height={size.height} fill={`url(#${id})`} />
          </Svg>
        )}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  clip: {
    overflow: 'hidden', // clip the gradient rect to the (rounded) container
  },
});

export default LinearGradient;
