import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, ChevronLeft, ChevronRight, Star, Ticket, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { PackageClassSelector } from './PackageClassSelector';
import { useLanguageStore } from '@/store/languageStore';

interface BundleTier {
  id: string;
  course_id: string;
  name: string;
  price_cents: number;
  max_selections: number;
  position: number;
  class_filter_mode: 'all' | 'specific';
  is_popular: boolean;
}

interface BundlePurchaseWizardProps {
  courseId: string;
  courseName: string;
}

type WizardStep = 'tier' | 'classes' | 'summary';

export function BundlePurchaseWizard({ courseId, courseName }: BundlePurchaseWizardProps) {
  const { t } = useLanguageStore();
  const [step, setStep] = useState<WizardStep>('tier');
  const [tiers, setTiers] = useState<BundleTier[]>([]);
  const [selectedTier, setSelectedTier] = useState<BundleTier | null>(null);
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);
  const [selectedClassNames, setSelectedClassNames] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [allowedClassIds, setAllowedClassIds] = useState<string[] | null>(null);

  useEffect(() => {
    loadTiers();
  }, [courseId]);

  useEffect(() => {
    if (selectedTier) {
      loadAllowedClasses();
    }
  }, [selectedTier]);

  const loadTiers = async () => {
    try {
      const { data, error } = await supabase
        .from('course_bundle_tiers' as any)
        .select('*')
        .eq('course_id', courseId)
        .order('position', { ascending: true });

      if (error) throw error;
      setTiers((data as unknown as BundleTier[]) || []);
    } catch (error) {
      console.error('Error loading tiers:', error);
      toast.error('Kunde inte ladda paketinformation');
    } finally {
      setLoading(false);
    }
  };

  const loadAllowedClasses = async () => {
    if (!selectedTier) return;

    if (selectedTier.class_filter_mode === 'all') {
      setAllowedClassIds(null); // null means all classes are allowed
    } else {
      // Load tier-specific classes
      const { data, error } = await supabase
        .from('course_bundle_tier_classes' as any)
        .select('class_id')
        .eq('tier_id', selectedTier.id);

      if (error) {
        console.error('Error loading tier classes:', error);
        setAllowedClassIds([]);
      } else {
        setAllowedClassIds((data as any[])?.map(tc => tc.class_id) || []);
      }
    }
  };

  const handleSelectTier = (tier: BundleTier) => {
    setSelectedTier(tier);
    setSelectedClassIds([]);
    setSelectedClassNames([]);
    setStep('classes');
  };

  const handleClassSelectionChange = async (classIds: string[]) => {
    setSelectedClassIds(classIds);
    
    // Fetch class names for summary
    if (classIds.length > 0) {
      const { data } = await supabase
        .from('course_classes')
        .select('id, name')
        .in('id', classIds);
      
      setSelectedClassNames(data?.map(c => c.name) || []);
    } else {
      setSelectedClassNames([]);
    }
  };

  const handleProceedToCheckout = async () => {
    if (!selectedTier || selectedClassIds.length === 0) return;

    try {
      setProcessing(true);
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast.error(t.auth?.pleaseLogin || 'Please log in to purchase');
        return;
      }

      const { data, error } = await supabase.functions.invoke('create-course-payment', {
        body: { 
          course_id: courseId,
          tier_id: selectedTier.id,
          selected_class_ids: selectedClassIds,
        },
      });

      if (error) throw error;

      if (data?.url) {
        window.open(data.url, '_blank');
      }
    } catch (error: any) {
      console.error('Checkout error:', error);
      toast.error(t.course?.enrollmentError || 'Failed to create payment');
    } finally {
      setProcessing(false);
    }
  };

  const goBack = () => {
    if (step === 'classes') {
      setStep('tier');
      setSelectedTier(null);
      setSelectedClassIds([]);
    } else if (step === 'summary') {
      setStep('classes');
    }
  };

  const goNext = () => {
    if (step === 'classes' && selectedClassIds.length > 0) {
      setStep('summary');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (tiers.length === 0) {
    return (
      <Card className="p-6">
        <p className="text-muted-foreground text-center">
          Inga paket tillgängliga för denna kurs.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Progress indicator */}
      <div className="flex items-center justify-center gap-2">
        <div className={`flex items-center gap-2 ${step === 'tier' ? 'text-primary font-semibold' : 'text-muted-foreground'}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${step === 'tier' ? 'bg-primary text-primary-foreground' : 'bg-primary/20 text-primary'}`}>
            {step !== 'tier' ? <Check className="h-4 w-4" /> : '1'}
          </div>
          <span className="hidden sm:inline">Välj paket</span>
        </div>
        <div className="w-8 h-px bg-border" />
        <div className={`flex items-center gap-2 ${step === 'classes' ? 'text-primary font-semibold' : 'text-muted-foreground'}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${step === 'classes' ? 'bg-primary text-primary-foreground' : step === 'summary' ? 'bg-primary/20 text-primary' : 'bg-muted'}`}>
            {step === 'summary' ? <Check className="h-4 w-4" /> : '2'}
          </div>
          <span className="hidden sm:inline">Välj klasser</span>
        </div>
        <div className="w-8 h-px bg-border" />
        <div className={`flex items-center gap-2 ${step === 'summary' ? 'text-primary font-semibold' : 'text-muted-foreground'}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${step === 'summary' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
            3
          </div>
          <span className="hidden sm:inline">Bekräfta</span>
        </div>
      </div>

      {/* Step 1: Tier Selection */}
      {step === 'tier' && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-center">Välj ditt paket</h2>
          <div className="grid gap-4 md:grid-cols-3">
            {tiers.map((tier) => (
              <Card
                key={tier.id}
                className={`cursor-pointer transition-all hover:border-primary ${
                  tier.is_popular ? 'border-primary ring-2 ring-primary/20' : ''
                }`}
                onClick={() => handleSelectTier(tier)}
              >
                <CardContent className="p-6 text-center relative">
                  {tier.is_popular && (
                    <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 gap-1">
                      <Star className="h-3 w-3" /> Populär
                    </Badge>
                  )}
                  <h3 className="text-lg font-bold mt-2">{tier.name}</h3>
                  <p className="text-3xl font-bold text-primary my-4">
                    {(tier.price_cents / 100).toLocaleString('sv-SE')} kr
                  </p>
                  <p className="text-muted-foreground mb-4">
                    {tier.max_selections} {tier.max_selections === 1 ? 'klass' : 'klasser'}
                  </p>
                  <Button variant={tier.is_popular ? 'default' : 'outline'} className="w-full">
                    Välj
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Step 2: Class Selection */}
      {step === 'classes' && selectedTier && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Button variant="ghost" onClick={goBack}>
              <ChevronLeft className="h-4 w-4 mr-1" /> Tillbaka
            </Button>
            <div className="text-center">
              <h2 className="text-xl font-semibold">Välj dina klasser</h2>
              <p className="text-sm text-muted-foreground">
                {selectedTier.name} - välj upp till {selectedTier.max_selections} klasser
              </p>
            </div>
            <div className="w-24" /> {/* Spacer for alignment */}
          </div>

          <PackageClassSelector
            courseId={courseId}
            maxSelections={selectedTier.max_selections}
            selectedClassIds={selectedClassIds}
            onSelectionChange={handleClassSelectionChange}
            allowedClassIds={allowedClassIds}
          />

          <div className="flex justify-end">
            <Button
              onClick={goNext}
              disabled={selectedClassIds.length === 0}
              className="gap-2"
            >
              Fortsätt <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Summary */}
      {step === 'summary' && selectedTier && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <Button variant="ghost" onClick={goBack}>
              <ChevronLeft className="h-4 w-4 mr-1" /> Tillbaka
            </Button>
            <h2 className="text-xl font-semibold">Sammanfattning</h2>
            <div className="w-24" />
          </div>

          <Card>
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center justify-between pb-4 border-b">
                <div>
                  <p className="font-semibold">{courseName}</p>
                  <p className="text-sm text-muted-foreground">{selectedTier.name}</p>
                </div>
                <Badge variant="outline">
                  {selectedClassIds.length} {selectedClassIds.length === 1 ? 'klass' : 'klasser'}
                </Badge>
              </div>

              <div>
                <p className="text-sm font-medium mb-2">Valda klasser:</p>
                <ul className="space-y-1">
                  {selectedClassNames.map((name, idx) => (
                    <li key={idx} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Check className="h-3 w-3 text-primary" />
                      {name}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="flex items-center justify-between pt-4 border-t">
                <p className="font-semibold">Totalt</p>
                <p className="text-2xl font-bold text-primary">
                  {(selectedTier.price_cents / 100).toLocaleString('sv-SE')} kr
                </p>
              </div>
            </CardContent>
          </Card>

          <Button
            onClick={handleProceedToCheckout}
            disabled={processing}
            size="lg"
            className="w-full gap-2"
          >
            {processing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Bearbetar...
              </>
            ) : (
              <>
                <Ticket className="h-4 w-4" />
                Fortsätt till betalning
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
