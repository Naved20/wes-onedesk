import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import {
  MapPin,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Navigation,
  Save,
  Volume2,
  Globe,
  Sliders,
  CheckCircle2,
  HelpCircle,
  ExternalLink,
} from "lucide-react";
import {
  GeoFenceSettings,
  getGeoFenceSettings,
  saveGeoFenceSettings,
  playGeoBeep,
  calculateHaversineDistance,
} from "@/lib/geoFenceManager";

export function FaceHubGeoFenceModal() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [settings, setSettings] = useState<GeoFenceSettings>({
    is_enabled: false,
    latitude: 28.6139,
    longitude: 77.2090,
    radius_meters: 200,
    address: "",
  });

  const [presetRadius] = [50, 100, 200, 500, 1000];

  useEffect(() => {
    if (open) {
      loadSettings();
    }
  }, [open]);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const data = await getGeoFenceSettings();
      setSettings(data);
    } catch (err) {
      console.error("Failed to load geofence settings", err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleEnable = (enabled: boolean) => {
    if (enabled) {
      playGeoBeep.toggleOn();
    } else {
      playGeoBeep.toggleOff();
    }
    setSettings((prev) => ({ ...prev, is_enabled: enabled }));
  };

  const handleFetchCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast({
        title: "Geolocation Unsupported",
        description: "Your browser does not support GPS location.",
        variant: "destructive",
      });
      return;
    }

    setGettingLocation(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = parseFloat(pos.coords.latitude.toFixed(6));
        const lng = parseFloat(pos.coords.longitude.toFixed(6));

        playGeoBeep.selectMapLocation();

        let addressStr = "";
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`
          );
          const data = await res.json();
          if (data.display_name) {
            addressStr = data.display_name;
          }
        } catch (e) {
          console.warn("Address reverse geocode failed", e);
        }

        setSettings((prev) => ({
          ...prev,
          latitude: lat,
          longitude: lng,
          address: addressStr || prev.address || `${lat}, ${lng}`,
        }));

        setGettingLocation(false);
        toast({
          title: "Location Captured",
          description: `Captured GPS coordinates: ${lat}, ${lng}`,
        });
      },
      (err) => {
        setGettingLocation(false);
        console.error("GPS Error", err);
        toast({
          title: "GPS Error",
          description: "Could not capture location. Please check browser GPS permissions.",
          variant: "destructive",
        });
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleSave = async () => {
    if (settings.radius_meters <= 0) {
      toast({
        title: "Invalid Radius",
        description: "Range radius must be greater than 0 meters.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      await saveGeoFenceSettings(settings);
      toast({
        title: "Geo-Fencing Saved Successfully",
        description: settings.is_enabled
          ? `Geo-Fencing is ACTIVE within ${settings.radius_meters}m boundary.`
          : "Geo-Fencing is currently DISABLED.",
      });
      setOpen(false);
    } catch (err) {
      toast({
        title: "Save Failed",
        description: "Could not save Geo-Fencing configuration.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Construct OSM Iframe URL centered at latitude, longitude
  const mapIframeUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${
    settings.longitude - 0.005
  },${settings.latitude - 0.003},${settings.longitude + 0.005},${
    settings.latitude + 0.003
  }&layer=mapnik&marker=${settings.latitude},${settings.longitude}`;

  return (
    <>
      {/* Trigger Button next to OTP button */}
      <Button
        variant={settings.is_enabled ? "default" : "outline"}
        onClick={() => setOpen(true)}
        className={`flex items-center gap-2 ${
          settings.is_enabled
            ? "bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-sm"
            : "border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200"
        }`}
      >
        {settings.is_enabled ? (
          <ShieldCheck className="h-4 w-4 text-white animate-pulse" />
        ) : (
          <ShieldAlert className="h-4 w-4 text-amber-500" />
        )}
        <span>
          Geo-Fence: {settings.is_enabled ? `${settings.radius_meters || 200}m Active` : "Disabled"}
        </span>
      </Button>

      {/* Main Settings Modal */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-6 sm:p-7">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={`p-2.5 rounded-xl ${
                    settings.is_enabled
                      ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600"
                      : "bg-amber-100 dark:bg-amber-950/60 text-amber-600"
                  }`}
                >
                  <MapPin className="h-6 w-6" />
                </div>
                <div>
                  <DialogTitle className="text-xl font-bold">FaceHub Geo-Fencing Configuration</DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                    Restrict FaceHub login & attendance check-ins within a specific location & radius boundary
                  </DialogDescription>
                </div>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-6 py-3">
            {/* Master Toggle Card */}
            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-xl border border-border/60 shadow-sm">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-base">Geo-Fencing Protection</span>
                  <Badge
                    variant={settings.is_enabled ? "default" : "secondary"}
                    className={
                      settings.is_enabled
                        ? "bg-emerald-600 text-white"
                        : "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                    }
                  >
                    {settings.is_enabled ? "ENABLED (STRICT)" : "DISABLED (OPEN ACCESS)"}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {settings.is_enabled
                    ? `Users can only login when physically inside ${settings.radius_meters}m of the office location.`
                    : "Employees can log into FaceHub from any location without distance restriction."}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Switch
                  checked={settings.is_enabled}
                  onCheckedChange={handleToggleEnable}
                  className="data-[state=checked]:bg-emerald-600"
                />
              </div>
            </div>

            {/* Section 1: Radius & Range Selection */}
            <div className="space-y-3 p-4 rounded-xl border border-border/60 bg-card">
              <div className="flex items-center justify-between">
                <Label htmlFor="radius-range" className="text-sm font-semibold flex items-center gap-2">
                  <Sliders className="h-4 w-4 text-emerald-600" />
                  Area Range Radius (Meters)
                </Label>
                <span className="text-xs font-mono font-bold px-2.5 py-1 bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 rounded-md">
                  {settings.radius_meters} Meters ({ (settings.radius_meters / 1000).toFixed(2) } km)
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                <div>
                  <Input
                    id="radius-range"
                    type="number"
                    min={10}
                    max={10000}
                    step={10}
                    value={settings.radius_meters}
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 0;
                      setSettings((prev) => ({ ...prev, radius_meters: val }));
                    }}
                    placeholder="Enter radius in meters (e.g., 200)"
                    className="font-mono text-base font-semibold"
                  />
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Enter manual distance in meters (e.g. 200 for 200m).
                  </p>
                </div>

                {/* Quick Presets */}
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground block font-medium">Quick Presets:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {presetRadius.map((r) => (
                      <Button
                        key={r}
                        type="button"
                        variant={settings.radius_meters === r ? "default" : "outline"}
                        size="sm"
                        onClick={() => {
                          playGeoBeep.selectMapLocation();
                          setSettings((prev) => ({ ...prev, radius_meters: r }));
                        }}
                        className={`h-7 text-xs px-2.5 ${
                          settings.radius_meters === r
                            ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                            : ""
                        }`}
                      >
                        {r}m {r === 200 && "(Default)"}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Section 2: Location Setup & Map */}
            <div className="space-y-3 p-4 rounded-xl border border-border/60 bg-card">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <Label className="text-sm font-semibold flex items-center gap-2">
                  <Globe className="h-4 w-4 text-emerald-600" />
                  Target Geo-Fence Location & Map
                </Label>

                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={handleFetchCurrentLocation}
                  disabled={gettingLocation}
                  className="h-8 text-xs flex items-center gap-1.5 bg-emerald-50 text-emerald-70 font-medium hover:bg-emerald-100 dark:bg-emerald-950/60"
                >
                  <Navigation className={`h-3.5 w-3.5 ${gettingLocation ? "animate-spin" : ""}`} />
                  {gettingLocation ? "Detecting GPS..." : "Set to My Current Location"}
                </Button>
              </div>

              {/* Coordinates input */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="latitude" className="text-xs text-muted-foreground">
                    Latitude
                  </Label>
                  <Input
                    id="latitude"
                    type="number"
                    step="0.000001"
                    value={settings.latitude}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      playGeoBeep.selectMapLocation();
                      setSettings((prev) => ({ ...prev, latitude: val }));
                    }}
                    className="font-mono text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="longitude" className="text-xs text-muted-foreground">
                    Longitude
                  </Label>
                  <Input
                    id="longitude"
                    type="number"
                    step="0.000001"
                    value={settings.longitude}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      playGeoBeep.selectMapLocation();
                      setSettings((prev) => ({ ...prev, longitude: val }));
                    }}
                    className="font-mono text-sm"
                  />
                </div>
              </div>

              {/* Location Address input */}
              <div className="space-y-1">
                <Label htmlFor="address-name" className="text-xs text-muted-foreground">
                  Location Name / Address
                </Label>
                <Input
                  id="address-name"
                  type="text"
                  value={settings.address || ""}
                  onChange={(e) =>
                    setSettings((prev) => ({ ...prev, address: e.target.value }))
                  }
                  placeholder="e.g. Main Campus / HQ Office Building"
                  className="text-sm"
                />
              </div>

              {/* Interactive OpenStreetMap Embed */}
              <div className="space-y-2 mt-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Interactive Map Preview:</span>
                  <a
                    href={`https://www.google.com/maps?q=${settings.latitude},${settings.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline flex items-center gap-1"
                  >
                    Open in Google Maps <ExternalLink className="h-3 w-3" />
                  </a>
                </div>

                <div className="relative rounded-xl overflow-hidden border border-border shadow-inner bg-muted h-52">
                  <iframe
                    title="Geo-Fence Location Map"
                    width="100%"
                    height="100%"
                    frameBorder="0"
                    scrolling="no"
                    marginHeight={0}
                    marginWidth={0}
                    src={mapIframeUrl}
                    className="w-full h-full border-0"
                  />

                  {/* Radius Overlay Badge */}
                  <div className="absolute top-2 right-2 bg-background/90 backdrop-blur-md px-3 py-1.5 rounded-lg border border-border shadow-sm text-xs flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping"></span>
                    <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                      Center Pin Target ({settings.radius_meters}m radius)
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t">
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <Volume2 className="h-3.5 w-3.5 text-emerald-600" />
              <span>Audio Beep confirmation enabled on toggle & save.</span>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <Button variant="outline" type="button" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleSave}
                disabled={loading}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium flex items-center gap-2"
              >
                <Save className="h-4 w-4" />
                {loading ? "Saving..." : "Save Geo-Fence Configuration"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
