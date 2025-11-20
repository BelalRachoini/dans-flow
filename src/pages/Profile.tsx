import { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useLanguageStore } from '@/store/languageStore';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { Loader2, Upload, Lock } from 'lucide-react';

type DanceLevel = 'beginner' | 'intermediate' | 'pro';

interface DanceExperience {
  salsa?: DanceLevel;
  bachata?: DanceLevel;
  kizomba?: DanceLevel;
  zouk?: DanceLevel;
}

interface ProfileData {
  full_name: string;
  email: string;
  phone: string;
  avatar_url: string;
  dance_experience: DanceExperience;
}

const danceStyles = ['salsa', 'bachata', 'kizomba', 'zouk'] as const;

export default function Profile() {
  const { userId } = useAuthStore();
  const { t } = useLanguageStore();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [profile, setProfile] = useState<ProfileData>({
    full_name: '',
    email: '',
    phone: '',
    avatar_url: '',
    dance_experience: {},
  });

  // Password change dialog state
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    loadProfile();
  }, [userId]);

  const loadProfile = async () => {
    if (!userId) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('full_name, email, phone, avatar_url, dance_experience')
        .eq('id', userId)
        .single();

      if (error) throw error;

      setProfile({
        full_name: data.full_name || '',
        email: data.email || '',
        phone: data.phone || '',
        avatar_url: data.avatar_url || '',
        dance_experience: (data.dance_experience as DanceExperience) || {},
      });
    } catch (error) {
      console.error('Error loading profile:', error);
      toast({
        title: t.profile.error || 'Error',
        description: t.profile.loadError || 'Failed to load profile',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !userId) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: t.profile.error || 'Error',
        description: t.profile.invalidFileType || 'Please upload an image file',
        variant: 'destructive',
      });
      return;
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: t.profile.error || 'Error',
        description: t.profile.fileTooLarge || 'File size must be less than 5MB',
        variant: 'destructive',
      });
      return;
    }

    setUploading(true);

    try {
      // Delete old avatar if exists
      if (profile.avatar_url) {
        const oldPath = profile.avatar_url.split('/').pop();
        if (oldPath) {
          await supabase.storage.from('avatars').remove([`${userId}/${oldPath}`]);
        }
      }

      // Upload new avatar
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `${userId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      // Update profile with new avatar URL
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', userId);

      if (updateError) throw updateError;

      setProfile({ ...profile, avatar_url: publicUrl });
      toast({
        title: t.profile.success || 'Success',
        description: t.profile.avatarUpdated || 'Profile picture updated',
      });
    } catch (error) {
      console.error('Error uploading avatar:', error);
      toast({
        title: t.profile.error || 'Error',
        description: t.profile.uploadError || 'Failed to upload image',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  const handleDanceLevelChange = (style: typeof danceStyles[number], level: DanceLevel | 'none') => {
    const newExperience = { ...profile.dance_experience };
    if (level === 'none') {
      delete newExperience[style];
    } else {
      newExperience[style] = level;
    }
    setProfile({ ...profile, dance_experience: newExperience });
  };

  const handleSaveProfile = async () => {
    if (!userId) return;

    setSaving(true);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          phone: profile.phone,
          dance_experience: profile.dance_experience as any,
        })
        .eq('id', userId);

      if (error) throw error;

      toast({
        title: t.profile.success || 'Success',
        description: t.profile.profileUpdated || 'Profile updated successfully',
      });
    } catch (error) {
      console.error('Error saving profile:', error);
      toast({
        title: t.profile.error || 'Error',
        description: t.profile.saveError || 'Failed to save profile',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      toast({
        title: t.profile.error || 'Error',
        description: t.profile.passwordMismatch || 'Passwords do not match',
        variant: 'destructive',
      });
      return;
    }

    if (newPassword.length < 6) {
      toast({
        title: t.profile.error || 'Error',
        description: t.profile.passwordTooShort || 'Password must be at least 6 characters',
        variant: 'destructive',
      });
      return;
    }

    setChangingPassword(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      toast({
        title: t.profile.success || 'Success',
        description: t.profile.passwordUpdated || 'Password changed successfully',
      });
      setPasswordDialogOpen(false);
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      console.error('Error changing password:', error);
      toast({
        title: t.profile.error || 'Error',
        description: t.profile.passwordError || 'Failed to change password',
        variant: 'destructive',
      });
    } finally {
      setChangingPassword(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6">{t.profile.title}</h1>

      {/* Profile Picture Section */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>{t.profile.profilePicture}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4">
          <Avatar className="h-32 w-32">
            <AvatarImage src={profile.avatar_url} alt={profile.full_name} />
            <AvatarFallback className="text-2xl">
              {profile.full_name?.charAt(0)?.toUpperCase() || '?'}
            </AvatarFallback>
          </Avatar>
          <div>
            <Input
              type="file"
              accept="image/*"
              onChange={handleAvatarUpload}
              disabled={uploading}
              className="hidden"
              id="avatar-upload"
            />
            <Label htmlFor="avatar-upload">
              <Button variant="outline" disabled={uploading} asChild>
                <span className="cursor-pointer">
                  {uploading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="mr-2 h-4 w-4" />
                  )}
                  {profile.avatar_url ? t.profile.changePicture : t.profile.uploadPicture}
                </span>
              </Button>
            </Label>
          </div>
        </CardContent>
      </Card>

      {/* Personal Information Section */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>{t.profile.personalInfo}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>{t.profile.fullName}</Label>
            <Input value={profile.full_name} disabled className="bg-muted" />
          </div>
          <div>
            <Label>{t.profile.email}</Label>
            <Input value={profile.email} disabled className="bg-muted" />
          </div>
          <div>
            <Label htmlFor="phone">{t.profile.phone}</Label>
            <Input
              id="phone"
              value={profile.phone}
              onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
              placeholder="+46 70 123 45 67"
            />
          </div>
        </CardContent>
      </Card>

      {/* Dance Experience Section */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>{t.profile.danceExperience}</CardTitle>
          <CardDescription>{t.profile.selectYourLevel}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {danceStyles.map((style) => (
            <div key={style} className="flex items-center gap-4">
              <Label className="w-24 capitalize">{style}</Label>
              <Select
                value={profile.dance_experience[style] || 'none'}
                onValueChange={(value) => handleDanceLevelChange(style, value as DanceLevel | 'none')}
              >
                <SelectTrigger className="flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t.profile.noExperience}</SelectItem>
                  <SelectItem value="beginner">{t.profile.beginner}</SelectItem>
                  <SelectItem value="intermediate">{t.profile.intermediate}</SelectItem>
                  <SelectItem value="pro">{t.profile.pro}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Security Section */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>{t.profile.security}</CardTitle>
        </CardHeader>
        <CardContent>
          <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Lock className="mr-2 h-4 w-4" />
                {t.profile.changePassword}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t.profile.changePassword}</DialogTitle>
                <DialogDescription>{t.profile.enterNewPassword}</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <Label htmlFor="new-password">{t.profile.newPassword}</Label>
                  <Input
                    id="new-password"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="confirm-password">{t.profile.confirmPassword}</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  onClick={handleChangePassword}
                  disabled={changingPassword || !newPassword || !confirmPassword}
                >
                  {changingPassword && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {t.profile.changePassword}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>

      {/* Save Changes Button */}
      <div className="flex justify-end">
        <Button onClick={handleSaveProfile} disabled={saving} size="lg">
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {t.profile.saveChanges}
        </Button>
      </div>
    </div>
  );
}
