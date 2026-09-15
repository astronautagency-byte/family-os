import { useEffect } from 'react';
import { useHouseholdFeatures } from '../context/HouseholdFeaturesContext';
import { launchBrandConfetti, resetBrandConfetti } from '../lib/brandConfetti';
export default function CelebrationConfetti({ intensity = 100 }) {
  const { features } = useHouseholdFeatures();
  useEffect(() => {
    if (features.celebrations === false) return;
    launchBrandConfetti({ particleCount: intensity });
    return resetBrandConfetti;
  }, [intensity, features.celebrations]);
  return null;
}
