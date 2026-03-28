/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useCallback, useEffect, useRef } from 'react';
import { Modal, Button, Group, Text, Stack, TextInput, Alert } from '@mantine/core';
import { IconMapPin, IconAlertCircle } from '@tabler/icons-react';
import {
  APIProvider,
  Map,
  AdvancedMarker,
  useMapsLibrary,
} from '@vis.gl/react-google-maps';

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

// Default center: Addis Ababa
const ADDIS_ABABA_CENTER = { lat: 9.005401, lng: 38.763611 };

function parseCoordinatePair(
  latRaw: string,
  lngRaw: string
): { lat: number; lng: number } | null {
  const lat = parseFloat(latRaw.trim());
  const lng = parseFloat(lngRaw.trim());
  if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

interface GpsSelection {
  lat: number;
  lng: number;
  address?: string;
}

interface MapPickerProps {
  initialLat?: number;
  initialLng?: number;
  onSelect: (selection: GpsSelection) => void;
}

function MapPicker({ initialLat, initialLng, onSelect }: MapPickerProps) {
  const geocodingLib = useMapsLibrary('geocoding');
  const [marker, setMarker] = useState<{ lat: number; lng: number } | null>(
    initialLat && initialLng ? { lat: initialLat, lng: initialLng } : null
  );

  const handleMapClick = useCallback(
    (e: any) => {
      if (!e.latLng) return;
      const lat = e.latLng.lat();
      const lng = e.latLng.lng();
      setMarker({ lat, lng });

      if (geocodingLib) {
        const geocoder = new geocodingLib.Geocoder();
        geocoder.geocode({ location: { lat, lng } }, (results: any, status: any) => {
          const address =
            status === 'OK' && results?.[0] ? results[0].formatted_address : undefined;
          onSelect({ lat, lng, address });
        });
      } else {
        onSelect({ lat, lng });
      }
    },
    [geocodingLib, onSelect]
  );

  return (
    <Map
      style={{ width: '100%', height: '400px' }}
      defaultCenter={
        initialLat && initialLng ? { lat: initialLat, lng: initialLng } : ADDIS_ABABA_CENTER
      }
      defaultZoom={initialLat && initialLng ? 15 : 12}
      gestureHandling="greedy"
      disableDefaultUI={false}
      mapId="warehouse-gps-map"
      onClick={handleMapClick}
    >
      {marker && <AdvancedMarker position={marker} />}
    </Map>
  );
}

interface GpsMapModalProps {
  opened: boolean;
  onClose: () => void;
  onSave: (data: { latitude: number; longitude: number; address?: string }) => void;
  loading?: boolean;
  initialLat?: number;
  initialLng?: number;
  title?: string;
}

export function GpsMapModal({
  opened,
  onClose,
  onSave,
  loading,
  initialLat,
  initialLng,
  title = 'Set GPS Location',
}: GpsMapModalProps) {
  const [selection, setSelection] = useState<GpsSelection | null>(
    initialLat != null && initialLng != null ? { lat: initialLat, lng: initialLng } : null
  );
  const [manualLat, setManualLat] = useState(initialLat?.toString() || '');
  const [manualLng, setManualLng] = useState(initialLng?.toString() || '');
  /** Only seed from props when the modal opens — avoids wiping edits when parent re-renders or coords refresh while open. */
  const wasOpenedRef = useRef(false);

  useEffect(() => {
    if (!opened) {
      wasOpenedRef.current = false;
      return;
    }
    if (wasOpenedRef.current) return;
    wasOpenedRef.current = true;

    if (initialLat != null && initialLng != null) {
      setSelection({ lat: initialLat, lng: initialLng });
      setManualLat(String(initialLat));
      setManualLng(String(initialLng));
    } else {
      setSelection(null);
      setManualLat('');
      setManualLng('');
    }
  }, [opened, initialLat, initialLng]);

  const handleMapSelect = (s: GpsSelection) => {
    setSelection(s);
    setManualLat(s.lat.toFixed(6));
    setManualLng(s.lng.toFixed(6));
  };

  const handleManualApply = () => {
    const pair = parseCoordinatePair(manualLat, manualLng);
    if (pair) {
      setSelection((prev) => ({ lat: pair.lat, lng: pair.lng, address: prev?.address }));
    }
  };

  const parsedForSave = parseCoordinatePair(manualLat, manualLng);
  const canSave = parsedForSave !== null;

  const handleSave = () => {
    const pair = parseCoordinatePair(manualLat, manualLng);
    if (!pair) return;
    onSave({
      latitude: pair.lat,
      longitude: pair.lng,
      address: selection?.address,
    });
  };

  const noApiKey = !GOOGLE_MAPS_API_KEY;

  return (
    <Modal opened={opened} onClose={onClose} title={title} size="xl" centered>
      <Stack gap="md">
        {noApiKey && (
          <Alert icon={<IconAlertCircle size={16} />} color="orange" title="Map unavailable">
            Google Maps API key not configured. Use manual coordinates below.
          </Alert>
        )}

        {!noApiKey && (
          <APIProvider apiKey={GOOGLE_MAPS_API_KEY}>
            <MapPicker
              key={
                initialLat != null && initialLng != null
                  ? `${initialLat.toFixed(6)},${initialLng.toFixed(6)}`
                  : 'no-initial'
              }
              initialLat={initialLat}
              initialLng={initialLng}
              onSelect={handleMapSelect}
            />
          </APIProvider>
        )}

        <Group align="flex-end" gap="sm">
          <TextInput
            label="Latitude"
            placeholder="9.005401"
            value={manualLat}
            onChange={(e) => setManualLat(e.currentTarget.value)}
            style={{ flex: 1 }}
          />
          <TextInput
            label="Longitude"
            placeholder="38.763611"
            value={manualLng}
            onChange={(e) => setManualLng(e.currentTarget.value)}
            style={{ flex: 1 }}
          />
          {noApiKey && (
            <Button type="button" variant="light" onClick={handleManualApply} disabled={!canSave}>
              Apply
            </Button>
          )}
        </Group>

        {(selection || parsedForSave) && (
          <Text size="sm" c="dimmed">
            Selected:{' '}
            {(selection ?? parsedForSave)!.lat.toFixed(6)}, {(selection ?? parsedForSave)!.lng.toFixed(6)}
            {selection?.address && ` — ${selection.address}`}
          </Text>
        )}

        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            leftSection={<IconMapPin size={16} />}
            onClick={handleSave}
            disabled={!canSave}
            loading={loading}
          >
            Save Location
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
