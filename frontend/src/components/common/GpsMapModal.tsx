import { useState, useCallback } from 'react';
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
    initialLat && initialLng ? { lat: initialLat, lng: initialLng } : null
  );
  const [manualLat, setManualLat] = useState(initialLat?.toString() || '');
  const [manualLng, setManualLng] = useState(initialLng?.toString() || '');

  const handleMapSelect = (s: GpsSelection) => {
    setSelection(s);
    setManualLat(s.lat.toFixed(6));
    setManualLng(s.lng.toFixed(6));
  };

  const handleManualApply = () => {
    const lat = parseFloat(manualLat);
    const lng = parseFloat(manualLng);
    if (!isNaN(lat) && !isNaN(lng)) {
      setSelection({ lat, lng });
    }
  };

  const handleSave = () => {
    if (!selection) return;
    onSave({ latitude: selection.lat, longitude: selection.lng, address: selection.address });
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
            <Button variant="light" onClick={handleManualApply}>
              Apply
            </Button>
          )}
        </Group>

        {selection && (
          <Text size="sm" c="dimmed">
            Selected: {selection.lat.toFixed(6)}, {selection.lng.toFixed(6)}
            {selection.address && ` — ${selection.address}`}
          </Text>
        )}

        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button
            leftSection={<IconMapPin size={16} />}
            onClick={handleSave}
            disabled={!selection && !manualLat}
            loading={loading}
          >
            Save Location
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
