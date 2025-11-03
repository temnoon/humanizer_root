import { useState, useEffect } from 'react';
import { startRegistration } from '@simplewebauthn/browser';

interface Device {
  id: string;
  deviceName: string;
  createdAt: number;
  lastUsedAt?: number;
}

interface DeviceManagerProps {
  token: string;
  userEmail: string;
}

export default function DeviceManager({ token }: DeviceManagerProps) {
  const [devices, setDevices] = useState<Device[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const [deviceName, setDeviceName] = useState('');
  const [showRegisterForm, setShowRegisterForm] = useState(false);

  useEffect(() => {
    fetchDevices();
  }, [token]);

  const fetchDevices = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('https://api.humanizer.com/webauthn/devices', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch devices');
      }

      const data = await response.json();
      setDevices(data.devices || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load devices');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegisterDevice = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!deviceName.trim()) {
      setError('Please enter a device name');
      return;
    }

    setIsRegistering(true);
    setError(null);

    try {
      // Get registration options from server
      const optionsResponse = await fetch('https://api.humanizer.com/webauthn/register-challenge', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!optionsResponse.ok) {
        throw new Error('Failed to start registration');
      }

      const options = await optionsResponse.json();

      // Start WebAuthn registration (Touch ID prompt appears here)
      const registrationResponse = await startRegistration(options);

      // Verify registration with server
      const verifyResponse = await fetch('https://api.humanizer.com/webauthn/register-verify', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          response: registrationResponse,
          deviceName: deviceName.trim()
        })
      });

      if (!verifyResponse.ok) {
        throw new Error('Failed to verify registration');
      }

      // Success!
      setDeviceName('');
      setShowRegisterForm(false);
      await fetchDevices(); // Refresh list
    } catch (err: any) {
      if (err.name === 'NotAllowedError') {
        setError('Registration cancelled or not allowed');
      } else {
        setError(err instanceof Error ? err.message : 'Failed to register device');
      }
    } finally {
      setIsRegistering(false);
    }
  };

  const handleRevokeDevice = async (deviceId: string) => {
    if (!confirm('Are you sure you want to revoke this device? You will no longer be able to use it for admin access.')) {
      return;
    }

    try {
      const response = await fetch(`https://api.humanizer.com/webauthn/devices/${deviceId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to revoke device');
      }

      await fetchDevices(); // Refresh list
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to revoke device');
    }
  };

  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: 'var(--spacing-2xl)' }}>
        <div className="loading"></div>
        <p style={{ marginTop: 'var(--spacing-md)', color: 'var(--text-secondary)' }}>
          Loading devices...
        </p>
      </div>
    );
  }

  return (
    <div>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 'var(--spacing-lg)'
      }}>
        <h2>Registered Devices</h2>
        {!showRegisterForm && (
          <button
            onClick={() => setShowRegisterForm(true)}
            className="btn btn-primary"
          >
            Register New Device
          </button>
        )}
      </div>

      {error && (
        <div className="error" style={{ marginBottom: 'var(--spacing-lg)' }}>
          {error}
        </div>
      )}

      {/* Registration Form */}
      {showRegisterForm && (
        <div className="card" style={{ marginBottom: 'var(--spacing-lg)' }}>
          <h3 style={{ marginBottom: 'var(--spacing-md)' }}>Register This Device</h3>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--spacing-lg)' }}>
            You'll be prompted to use Touch ID, Face ID, or a security key to register this device for admin access.
          </p>
          <form onSubmit={handleRegisterDevice}>
            <div style={{ marginBottom: 'var(--spacing-lg)' }}>
              <label style={{
                display: 'block',
                marginBottom: 'var(--spacing-sm)',
                fontWeight: 500
              }}>
                Device Name
              </label>
              <input
                type="text"
                value={deviceName}
                onChange={(e) => setDeviceName(e.target.value)}
                placeholder="e.g., MacBook Pro, iPhone 13"
                required
                disabled={isRegistering}
                style={{
                  width: '100%',
                  padding: 'var(--spacing-sm) var(--spacing-md)',
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--text-primary)'
                }}
              />
            </div>
            <div style={{ display: 'flex', gap: 'var(--spacing-md)' }}>
              <button
                type="submit"
                disabled={isRegistering}
                className="btn btn-primary"
                style={{
                  opacity: isRegistering ? 0.5 : 1,
                  cursor: isRegistering ? 'not-allowed' : 'pointer'
                }}
              >
                {isRegistering ? (
                  <>
                    <div className="loading"></div>
                    <span>Registering...</span>
                  </>
                ) : (
                  'Register Device'
                )}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowRegisterForm(false);
                  setDeviceName('');
                  setError(null);
                }}
                className="btn"
                style={{
                  background: 'none',
                  color: 'var(--text-secondary)'
                }}
                disabled={isRegistering}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Device List */}
      {devices.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 'var(--spacing-2xl)' }}>
          <p style={{ color: 'var(--text-secondary)' }}>
            No devices registered yet. Register this device to enable Touch ID login.
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 'var(--spacing-md)' }}>
          {devices.map((device) => (
            <div key={device.id} className="card" style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <div style={{ fontWeight: 600, marginBottom: 'var(--spacing-xs)' }}>
                  {device.deviceName}
                </div>
                <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                  Registered: {new Date(device.createdAt).toLocaleDateString()}
                  {device.lastUsedAt && (
                    <> • Last used: {new Date(device.lastUsedAt).toLocaleDateString()}</>
                  )}
                </div>
              </div>
              <button
                onClick={() => handleRevokeDevice(device.id)}
                className="btn"
                style={{
                  background: 'none',
                  color: 'var(--text-error)',
                  border: '1px solid var(--text-error)'
                }}
              >
                Revoke
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
