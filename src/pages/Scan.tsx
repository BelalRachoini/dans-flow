import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Camera, CheckCircle2, XCircle, Info, Loader2,
  User, Calendar, Clock, MapPin, AlertTriangle
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import QrScanner from 'qr-scanner';

interface CheckinResult {
  success: boolean;
  error?: string;
  message?: string;
  member_name?: string;
  course_title?: string;
  course_starts_at?: string;
  status_after?: string;
  checked_in_count?: number;
  max_checkins?: number;
  scanned_at?: string;
}

interface RecentCheckin {
  id: string;
  scanned_at: string;
  tickets: {
    member_id: string;
    courses: {
      title: string;
    };
    profiles: {
      full_name: string;
      avatar_url: string | null;
    };
  };
  scanned_by_profile: {
    full_name: string;
  };
}

export default function Scan() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [lastResult, setLastResult] = useState<CheckinResult | null>(null);
  const [manualCode, setManualCode] = useState('');
  const [recentCheckins, setRecentCheckins] = useState<RecentCheckin[]>([]);
  const [cameras, setCameras] = useState<QrScanner.Camera[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<string>('');
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerRef = useRef<QrScanner | null>(null);

  useEffect(() => {
    checkUserRole();
    loadRecentCheckins();
  }, []);

  const checkUserRole = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        navigate('/login');
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (!profile || !['instructor', 'admin'].includes(profile.role)) {
        toast({
          title: 'Ingen åtkomst',
          description: 'Du måste vara instruktör eller admin för att skanna biljetter',
          variant: 'destructive',
        });
        navigate('/');
        return;
      }

      setUserRole(profile.role);
    } catch (error: any) {
      toast({
        title: 'Fel',
        description: error.message,
        variant: 'destructive',
      });
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  const loadRecentCheckins = async () => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { data, error } = await supabase
        .from('checkins')
        .select(`
          id,
          scanned_at,
          tickets!inner (
            member_id,
            courses (title),
            profiles:member_id (full_name, avatar_url)
          ),
          scanned_by_profile:profiles!scanned_by (full_name)
        `)
        .gte('scanned_at', today.toISOString())
        .order('scanned_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      setRecentCheckins(data as any || []);
    } catch (error: any) {
      console.error('Error loading recent checkins:', error);
    }
  };

  const initializeCamera = async () => {
    if (!videoRef.current) return;

    try {
      // Get available cameras
      const availableCameras = await QrScanner.listCameras(true);
      setCameras(availableCameras);
      
      if (availableCameras.length > 0 && !selectedCamera) {
        setSelectedCamera(availableCameras[0].id);
      }

      // Initialize scanner
      const scanner = new QrScanner(
        videoRef.current,
        (result) => handleScan(result.data),
        {
          returnDetailedScanResult: true,
          highlightScanRegion: true,
          highlightCodeOutline: true,
        }
      );

      scannerRef.current = scanner;
      await scanner.start();
      setScanning(true);
    } catch (error: any) {
      toast({
        title: 'Kamera-fel',
        description: 'Kunde inte starta kameran. Kontrollera behörigheter.',
        variant: 'destructive',
      });
      console.error('Camera error:', error);
    }
  };

  const stopCamera = () => {
    if (scannerRef.current) {
      scannerRef.current.stop();
      scannerRef.current.destroy();
      scannerRef.current = null;
    }
    setScanning(false);
  };

  const switchCamera = async (cameraId: string) => {
    setSelectedCamera(cameraId);
    if (scannerRef.current) {
      await scannerRef.current.setCamera(cameraId);
    }
  };

  const handleScan = async (qrPayload: string) => {
    if (processing) return;
    
    setProcessing(true);
    try {
      const { data, error } = await supabase.rpc('check_in_with_qr', {
        qr: qrPayload,
        p_location: window.location.href,
        p_device_info: navigator.userAgent,
      });

      if (error) throw error;

      const result = data as unknown as CheckinResult;
      setLastResult(result);

      if (result.success) {
        toast({
          title: '✅ Incheckning lyckades!',
          description: `${result.member_name} - ${result.course_title}`,
        });
        loadRecentCheckins();
        
        // Clear result after 5 seconds
        setTimeout(() => {
          setLastResult(null);
        }, 5000);
      } else {
        toast({
          title: 'Fel vid incheckning',
          description: result.message || 'Något gick fel',
          variant: 'destructive',
        });
      }
    } catch (error: any) {
      toast({
        title: 'Fel',
        description: error.message || 'Kunde inte checka in',
        variant: 'destructive',
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleManualCheckin = async () => {
    if (!manualCode.trim()) {
      toast({
        title: 'Fel',
        description: 'Ange en giltig kod',
        variant: 'destructive',
      });
      return;
    }

    await handleScan(manualCode.trim());
    setManualCode('');
  };

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString('sv-SE', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('sv-SE', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Skanna biljetter</h1>
        <p className="mt-1 text-muted-foreground">
          Checka in medlemmar till kurser
        </p>
      </div>

      {/* Info Box */}
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="p-4 flex gap-3">
          <Info className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <div className="text-sm space-y-1">
            <p className="font-semibold">Så här fungerar det:</p>
            <p className="text-muted-foreground">
              Använd kameran för att skanna medlemmars QR-koder eller ange koden manuellt. 
              Systemet registrerar automatiskt incheckningen och uppdaterar biljettens status.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Scanner */}
      <Card>
        <CardHeader>
          <CardTitle>QR-skanning</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="camera" className="space-y-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="camera">Kamera-skanning</TabsTrigger>
              <TabsTrigger value="manual">Manuell kod</TabsTrigger>
            </TabsList>

            <TabsContent value="camera" className="space-y-4">
              {/* Camera Controls */}
              <div className="flex gap-3 flex-wrap">
                <Button
                  onClick={scanning ? stopCamera : initializeCamera}
                  variant={scanning ? "destructive" : "hero"}
                  disabled={processing}
                >
                  <Camera className="mr-2 h-4 w-4" />
                  {scanning ? 'Stoppa' : 'Starta'} kamera
                </Button>

                {cameras.length > 1 && scanning && (
                  <Select value={selectedCamera} onValueChange={switchCamera}>
                    <SelectTrigger className="w-[200px]">
                      <SelectValue placeholder="Välj kamera" />
                    </SelectTrigger>
                    <SelectContent>
                      {cameras.map((camera) => (
                        <SelectItem key={camera.id} value={camera.id}>
                          {camera.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {/* Camera Preview */}
              <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
                <video
                  ref={videoRef}
                  className="w-full h-full object-cover"
                  playsInline
                />
                {processing && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <Loader2 className="h-12 w-12 animate-spin text-white" />
                  </div>
                )}
              </div>

              {/* Last Result */}
              {lastResult && (
                <Alert variant={lastResult.success ? "default" : "destructive"}>
                  <div className="flex gap-3">
                    {lastResult.success ? (
                      <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
                    ) : (
                      <XCircle className="h-5 w-5 shrink-0" />
                    )}
                    <div className="flex-1 space-y-1">
                      {lastResult.success ? (
                        <>
                          <div className="font-semibold text-green-900">
                            Incheckning lyckades!
                          </div>
                          <div className="text-sm space-y-1">
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4" />
                              <span>{lastResult.member_name}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4" />
                              <span>{lastResult.course_title}</span>
                            </div>
                            <div className="text-muted-foreground">
                              Incheckningar: {lastResult.checked_in_count} / {lastResult.max_checkins}
                            </div>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="font-semibold">
                            {lastResult.error === 'ALREADY_CHECKED_IN' && 'Redan incheckad'}
                            {lastResult.error === 'INVALID_TICKET' && 'Ogiltig biljett'}
                            {lastResult.error === 'INVALID_STATUS' && 'Ogiltig status'}
                            {lastResult.error === 'UNAUTHORIZED' && 'Ingen behörighet'}
                            {!lastResult.error && 'Fel vid incheckning'}
                          </div>
                          <AlertDescription>{lastResult.message}</AlertDescription>
                        </>
                      )}
                    </div>
                  </div>
                </Alert>
              )}
            </TabsContent>

            <TabsContent value="manual" className="space-y-4">
              <div className="space-y-3">
                <label className="text-sm font-medium">Biljettkod</label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Klistra in eller skriv biljettkod..."
                    value={manualCode}
                    onChange={(e) => setManualCode(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleManualCheckin()}
                    disabled={processing}
                  />
                  <Button 
                    onClick={handleManualCheckin}
                    disabled={processing || !manualCode.trim()}
                  >
                    {processing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      'Checka in'
                    )}
                  </Button>
                </div>
              </div>

              {/* Last Result */}
              {lastResult && (
                <Alert variant={lastResult.success ? "default" : "destructive"}>
                  <div className="flex gap-3">
                    {lastResult.success ? (
                      <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
                    ) : (
                      <XCircle className="h-5 w-5 shrink-0" />
                    )}
                    <div className="flex-1 space-y-1">
                      {lastResult.success ? (
                        <>
                          <div className="font-semibold text-green-900">
                            Incheckning lyckades!
                          </div>
                          <div className="text-sm space-y-1">
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4" />
                              <span>{lastResult.member_name}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4" />
                              <span>{lastResult.course_title}</span>
                            </div>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="font-semibold">Fel vid incheckning</div>
                          <AlertDescription>{lastResult.message}</AlertDescription>
                        </>
                      )}
                    </div>
                  </div>
                </Alert>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Recent Check-ins */}
      <Card>
        <CardHeader>
          <CardTitle>Senaste incheckningar (idag)</CardTitle>
        </CardHeader>
        <CardContent>
          {recentCheckins.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Inga incheckningar ännu idag
            </p>
          ) : (
            <div className="space-y-3">
              {recentCheckins.map((checkin) => (
                <div 
                  key={checkin.id}
                  className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                >
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <User className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold truncate">
                      {checkin.tickets.profiles.full_name}
                    </div>
                    <div className="text-sm text-muted-foreground truncate">
                      {checkin.tickets.courses.title}
                    </div>
                  </div>
                  <div className="text-sm text-muted-foreground shrink-0">
                    {formatTime(checkin.scanned_at)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
