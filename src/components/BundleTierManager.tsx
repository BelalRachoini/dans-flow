import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, GripVertical, Star, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { MultiSelect } from '@/components/ui/multi-select';

interface BundleTier {
  id: string;
  course_id: string;
  name: string;
  price_cents: number;
  max_selections: number;
  position: number;
  class_filter_mode: 'all' | 'specific';
  is_popular: boolean;
  created_at: string;
  tier_classes?: string[]; // IDs of classes for this tier
}

interface CourseClass {
  id: string;
  name: string;
  day_of_week: number;
}

interface BundleTierManagerProps {
  courseId: string;
  onTiersChange?: () => void;
}

const dayLabels: Record<number, string> = {
  0: 'Sön',
  1: 'Mån',
  2: 'Tis',
  3: 'Ons',
  4: 'Tor',
  5: 'Fre',
  6: 'Lör',
};

export function BundleTierManager({ courseId, onTiersChange }: BundleTierManagerProps) {
  const [tiers, setTiers] = useState<BundleTier[]>([]);
  const [classes, setClasses] = useState<CourseClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // New tier form state
  const [newTierName, setNewTierName] = useState('');
  const [newTierPrice, setNewTierPrice] = useState('');
  const [newTierMaxSelections, setNewTierMaxSelections] = useState('1');

  useEffect(() => {
    loadData();
  }, [courseId]);

  const loadData = async () => {
    try {
      // Load tiers
      const { data: tiersData, error: tiersError } = await supabase
        .from('course_bundle_tiers' as any)
        .select('*')
        .eq('course_id', courseId)
        .order('position', { ascending: true });

      if (tiersError) throw tiersError;

      // Load tier-specific class mappings
      const tiersWithClasses = await Promise.all(((tiersData as any[]) || []).map(async (tier) => {
        if (tier.class_filter_mode === 'specific') {
          const { data: tierClasses } = await supabase
            .from('course_bundle_tier_classes' as any)
            .select('class_id')
            .eq('tier_id', tier.id);
          return {
            ...tier,
            tier_classes: tierClasses?.map((tc: any) => tc.class_id) || []
          };
        }
        return { ...tier, tier_classes: [] };
      }));

      setTiers(tiersWithClasses as BundleTier[]);

      // Load course classes
      const { data: classesData, error: classesError } = await supabase
        .from('course_classes')
        .select('id, name, day_of_week')
        .eq('course_id', courseId)
        .order('day_of_week', { ascending: true });

      if (classesError) throw classesError;
      setClasses(classesData || []);
    } catch (error) {
      console.error('Error loading tiers:', error);
      toast.error('Kunde inte ladda nivåer');
    } finally {
      setLoading(false);
    }
  };

  const handleAddTier = async () => {
    if (!newTierName.trim()) {
      toast.error('Ange ett namn för nivån');
      return;
    }

    const price = parseFloat(newTierPrice) || 0;
    const maxSelections = parseInt(newTierMaxSelections) || 1;

    try {
      setSaving(true);
      const { error } = await supabase
        .from('course_bundle_tiers' as any)
        .insert({
          course_id: courseId,
          name: newTierName.trim(),
          price_cents: Math.round(price * 100),
          max_selections: maxSelections,
          position: tiers.length,
          class_filter_mode: 'all',
          is_popular: false,
        });

      if (error) throw error;

      setNewTierName('');
      setNewTierPrice('');
      setNewTierMaxSelections('1');
      toast.success('Nivå tillagd');
      loadData();
      onTiersChange?.();
    } catch (error) {
      console.error('Error adding tier:', error);
      toast.error('Kunde inte lägga till nivå');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateTier = async (tier: BundleTier, updates: Partial<BundleTier>) => {
    try {
      setSaving(true);

      // Separate tier_classes from other updates
      const { tier_classes, ...dbUpdates } = updates as any;

      if (Object.keys(dbUpdates).length > 0) {
        const { error } = await supabase
          .from('course_bundle_tiers' as any)
          .update(dbUpdates)
          .eq('id', tier.id);

        if (error) throw error;
      }

      // Update tier-specific classes if class_filter_mode is 'specific'
      if (tier_classes !== undefined) {
        // Delete existing mappings
        await supabase
          .from('course_bundle_tier_classes' as any)
          .delete()
          .eq('tier_id', tier.id);

        // Insert new mappings
        if (tier_classes.length > 0) {
          const mappings = tier_classes.map((classId: string) => ({
            tier_id: tier.id,
            class_id: classId,
          }));

          const { error: insertError } = await supabase
            .from('course_bundle_tier_classes' as any)
            .insert(mappings);

          if (insertError) throw insertError;
        }
      }

      loadData();
      onTiersChange?.();
    } catch (error) {
      console.error('Error updating tier:', error);
      toast.error('Kunde inte uppdatera nivå');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTier = async (tierId: string) => {
    try {
      setSaving(true);
      const { error } = await supabase
        .from('course_bundle_tiers' as any)
        .delete()
        .eq('id', tierId);

      if (error) throw error;

      toast.success('Nivå borttagen');
      loadData();
      onTiersChange?.();
    } catch (error) {
      console.error('Error deleting tier:', error);
      toast.error('Kunde inte ta bort nivå');
    } finally {
      setSaving(false);
    }
  };

  const handleSetPopular = async (tierId: string) => {
    try {
      setSaving(true);
      
      // First, unset all tiers as popular
      await supabase
        .from('course_bundle_tiers' as any)
        .update({ is_popular: false })
        .eq('course_id', courseId);

      // Set selected tier as popular
      await supabase
        .from('course_bundle_tiers' as any)
        .update({ is_popular: true })
        .eq('id', tierId);

      loadData();
    } catch (error) {
      console.error('Error setting popular:', error);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="text-center py-4 text-muted-foreground">Laddar nivåer...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-semibold mb-2">Paketernivåer</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Skapa olika nivåer som kunder kan välja mellan (t.ex. Bronze, Silver, Gold)
        </p>
      </div>

      {/* Existing tiers */}
      {tiers.length > 0 && (
        <div className="space-y-3">
          {tiers.map((tier, index) => (
            <Card key={tier.id} className={tier.is_popular ? 'border-primary ring-1 ring-primary' : ''}>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="flex items-center gap-2 text-muted-foreground pt-2">
                    <GripVertical className="h-4 w-4" />
                    <span className="text-sm font-medium">{index + 1}</span>
                  </div>
                  
                  <div className="flex-1 space-y-4">
                    {/* Tier header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Input
                          value={tier.name}
                          onChange={(e) => {
                            const newTiers = [...tiers];
                            newTiers[index] = { ...tier, name: e.target.value };
                            setTiers(newTiers);
                          }}
                          onBlur={() => handleUpdateTier(tier, { name: tier.name })}
                          className="font-semibold w-40"
                        />
                        {tier.is_popular && (
                          <Badge variant="secondary" className="gap-1">
                            <Star className="h-3 w-3" /> Populär
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {!tier.is_popular && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleSetPopular(tier.id)}
                            className="text-xs"
                          >
                            <Star className="h-3 w-3 mr-1" /> Markera populär
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteTier(tier.id)}
                          className="text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Tier settings */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-xs text-muted-foreground">Pris (kr)</Label>
                        <Input
                          type="number"
                          value={tier.price_cents / 100}
                          onChange={(e) => {
                            const newTiers = [...tiers];
                            newTiers[index] = { ...tier, price_cents: Math.round(parseFloat(e.target.value) * 100) || 0 };
                            setTiers(newTiers);
                          }}
                          onBlur={() => handleUpdateTier(tier, { price_cents: tier.price_cents })}
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Max klasser</Label>
                        <Input
                          type="number"
                          min={1}
                          max={20}
                          value={tier.max_selections}
                          onChange={(e) => {
                            const newTiers = [...tiers];
                            newTiers[index] = { ...tier, max_selections: parseInt(e.target.value) || 1 };
                            setTiers(newTiers);
                          }}
                          onBlur={() => handleUpdateTier(tier, { max_selections: tier.max_selections })}
                        />
                      </div>
                    </div>

                    {/* Class filter mode */}
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Tillgängliga klasser</Label>
                      <Select
                        value={tier.class_filter_mode}
                        onValueChange={(value: 'all' | 'specific') => {
                          handleUpdateTier(tier, { class_filter_mode: value });
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Alla klasser i kursen</SelectItem>
                          <SelectItem value="specific">Specifika klasser</SelectItem>
                        </SelectContent>
                      </Select>

                      {tier.class_filter_mode === 'specific' && classes.length > 0 && (
                        <MultiSelect
                          options={classes.map((cls) => ({
                            label: `${cls.name} (${dayLabels[cls.day_of_week]})`,
                            value: cls.id,
                          }))}
                          selected={tier.tier_classes || []}
                          onChange={(values) => {
                            handleUpdateTier(tier, { tier_classes: values } as any);
                          }}
                          placeholder="Välj klasser för denna nivå..."
                        />
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add new tier */}
      <Card className="border-dashed">
        <CardContent className="p-4">
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Plus className="h-4 w-4" />
              <span className="text-sm font-medium">Lägg till ny nivå</span>
            </div>
            
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Namn</Label>
                <Input
                  placeholder="T.ex. Gold"
                  value={newTierName}
                  onChange={(e) => setNewTierName(e.target.value)}
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Pris (kr)</Label>
                <Input
                  type="number"
                  placeholder="500"
                  value={newTierPrice}
                  onChange={(e) => setNewTierPrice(e.target.value)}
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Max klasser</Label>
                <Input
                  type="number"
                  min={1}
                  max={20}
                  value={newTierMaxSelections}
                  onChange={(e) => setNewTierMaxSelections(e.target.value)}
                />
              </div>
            </div>

            <Button
              onClick={handleAddTier}
              disabled={saving || !newTierName.trim()}
              className="w-full"
            >
              <Plus className="h-4 w-4 mr-2" /> Lägg till nivå
            </Button>
          </div>
        </CardContent>
      </Card>

      {tiers.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4">
          Lägg till minst en nivå för att aktivera paketet
        </p>
      )}
    </div>
  );
}
