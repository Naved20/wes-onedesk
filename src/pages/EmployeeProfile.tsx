import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft, Save } from "lucide-react";
import { MyDocuments } from "@/components/employee/MyDocuments";

interface ProfileData {
  id: string;
  user_id: string;
  employee_id: string | null;
  first_name: string;
  last_name: string;
  email: string;
  designation: string | null;
  position: string | null;
  institution_assignment: string | null;
  phone: string | null;
  alternate_phone: string | null;
  gender: string | null;
  date_of_birth: string | null;
  date_of_joining: string | null;
  employment_type: string | null;
  employment_status: string | null;
  engagement_type: string | null;
  role_code: string | null;
  project_program: string | null;
  wes_mail: string | null;
  wes_mail_pass: string | null;
  aadhar_number: string | null;
  pan_number: string | null;
  passport_number: string | null;
  passport_expiry: string | null;
  nationality: string | null;
  marital_status: string | null;
  religion: string | null;
  race: string | null;
  blood_group: string | null;
  house_number: string | null;
  current_address: string | null;
  current_city: string | null;
  current_state: string | null;
  current_pincode: string | null;
  country: string | null;
  permanent_address: string | null;
  permanent_city: string | null;
  permanent_state: string | null;
  permanent_pincode: string | null;
  bank_name: string | null;
  bank_account_name: string | null;
  bank_account_number: string | null;
  bank_ifsc_code: string | null;
  bank_city: string | null;
  highest_qualification: string | null;
  degree: string | null;
  professional_qualification_teaching: string | null;
  university: string | null;
  year_of_passing: number | null;
  next_increment_date: string | null;
  training_record: string | null;
  education_worker_permit: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  emergency_contact_relation: string | null;
  medical_health_condition: string | null;
  has_driving_license: boolean | null;
  driving_license: string | null;
  vehicle_information: string | null;
  biometric_id: string | null;
  samagra_id: string | null;
  social_category: string | null;
  is_active: boolean | null;
}

export default function EmployeeProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { role, user } = useAuth();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const isOwnProfile = user?.id === profile?.user_id;
  const canEdit = role === "admin" || isOwnProfile;

  useEffect(() => {
    if (id) {
      fetchProfile(id);
    }
  }, [id]);

  const fetchProfile = async (profileId: string) => {
    try {
      const { data, error } = await supabase
        .from("employee_profiles")
        .select("*")
        .eq("id", profileId)
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        toast({ title: "Not Found", description: "Profile not found", variant: "destructive" });
        navigate("/employees");
        return;
      }
      setProfile(data as ProfileData);
    } catch (error) {
      console.error("Error fetching profile:", error);
      toast({ title: "Error", description: "Failed to load profile", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: keyof ProfileData, value: string | boolean | number | null) => {
    if (!profile) return;
    setProfile({ ...profile, [field]: value });
  };

  const handleSave = async () => {
    if (!profile) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("employee_profiles")
        .update({
          first_name: profile.first_name,
          last_name: profile.last_name,
          designation: profile.designation,
          position: profile.position,
          institution_assignment: profile.institution_assignment,
          phone: profile.phone,
          alternate_phone: profile.alternate_phone,
          gender: profile.gender,
          date_of_birth: profile.date_of_birth,
          date_of_joining: profile.date_of_joining,
          employment_type: profile.employment_type,
          employment_status: profile.employment_status,
          engagement_type: profile.engagement_type,
          role_code: profile.role_code,
          project_program: profile.project_program,
          wes_mail: profile.wes_mail,
          wes_mail_pass: profile.wes_mail_pass,
          aadhar_number: profile.aadhar_number,
          pan_number: profile.pan_number,
          passport_number: profile.passport_number,
          passport_expiry: profile.passport_expiry,
          nationality: profile.nationality,
          marital_status: profile.marital_status,
          religion: profile.religion,
          race: profile.race,
          blood_group: profile.blood_group,
          house_number: profile.house_number,
          current_address: profile.current_address,
          current_city: profile.current_city,
          current_state: profile.current_state,
          current_pincode: profile.current_pincode,
          country: profile.country,
          permanent_address: profile.permanent_address,
          permanent_city: profile.permanent_city,
          permanent_state: profile.permanent_state,
          permanent_pincode: profile.permanent_pincode,
          bank_name: profile.bank_name,
          bank_account_name: profile.bank_account_name,
          bank_account_number: profile.bank_account_number,
          bank_ifsc_code: profile.bank_ifsc_code,
          bank_city: profile.bank_city,
          highest_qualification: profile.highest_qualification,
          degree: profile.degree,
          professional_qualification_teaching: profile.professional_qualification_teaching,
          university: profile.university,
          year_of_passing: profile.year_of_passing,
          next_increment_date: profile.next_increment_date,
          training_record: profile.training_record,
          education_worker_permit: profile.education_worker_permit,
          emergency_contact_name: profile.emergency_contact_name,
          emergency_contact_phone: profile.emergency_contact_phone,
          emergency_contact_relation: profile.emergency_contact_relation,
          medical_health_condition: profile.medical_health_condition,
          has_driving_license: profile.has_driving_license,
          driving_license: profile.driving_license,
          vehicle_information: profile.vehicle_information,
          biometric_id: profile.biometric_id,
          samagra_id: profile.samagra_id,
          social_category: profile.social_category,
        })
        .eq("id", profile.id);

      if (error) throw error;
      toast({ title: "Saved", description: "Profile updated successfully" });
      setIsEditing(false);
    } catch (error) {
      console.error("Error saving profile:", error);
      toast({ title: "Error", description: "Failed to save profile", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  if (!profile) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">Profile not found</div>
      </DashboardLayout>
    );
  }

  const renderField = (label: string, field: keyof ProfileData, type: string = "text") => (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input
        type={type}
        value={(profile[field] as string) || ""}
        onChange={(e) => handleChange(field, e.target.value || null)}
        disabled={!isEditing}
      />
    </div>
  );

  const renderSelect = (label: string, field: keyof ProfileData, options: string[]) => (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select
        value={(profile[field] as string) || ""}
        onValueChange={(v) => handleChange(field, v || null)}
        disabled={!isEditing}
      >
        <SelectTrigger>
          <SelectValue placeholder="Select..." />
        </SelectTrigger>
        <SelectContent>
          {options.map((opt) => (
            <SelectItem key={opt} value={opt}>{opt}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">
                {profile.first_name} {profile.last_name}
              </h1>
              <p className="text-muted-foreground">{profile.designation || "No designation"}</p>
            </div>
          </div>
          {canEdit && (
            <div className="flex gap-2">
              {isEditing ? (
                <>
                  <Button variant="outline" onClick={() => setIsEditing(false)}>Cancel</Button>
                  <Button onClick={handleSave} disabled={saving}>
                    <Save className="h-4 w-4 mr-2" />
                    {saving ? "Saving..." : "Save"}
                  </Button>
                </>
              ) : (
                <Button onClick={() => setIsEditing(true)}>Edit Profile</Button>
              )}
            </div>
          )}
        </div>

        <Tabs defaultValue="personal" className="space-y-4">
          <TabsList className="flex flex-wrap h-auto gap-1">
            <TabsTrigger value="personal">Personal</TabsTrigger>
            <TabsTrigger value="employment">Employment</TabsTrigger>
            <TabsTrigger value="identity">Identity</TabsTrigger>
            <TabsTrigger value="address">Address</TabsTrigger>
            <TabsTrigger value="bank">Bank</TabsTrigger>
            <TabsTrigger value="education">Education</TabsTrigger>
            <TabsTrigger value="emergency">Emergency</TabsTrigger>
            <TabsTrigger value="documents">My Documents</TabsTrigger>
            <TabsTrigger value="other">Other</TabsTrigger>
          </TabsList>

          <TabsContent value="personal">
            <Card>
              <CardHeader><CardTitle>Personal Information</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {renderField("Employee ID", "employee_id")}
                {renderField("First Name", "first_name")}
                {renderField("Last Name", "last_name")}
                {renderField("Email", "email", "email")}
                {renderField("Phone", "phone", "tel")}
                {renderField("Alternate Phone", "alternate_phone", "tel")}
                {renderSelect("Gender", "gender", ["Male", "Female", "Other"])}
                {renderField("Date of Birth", "date_of_birth", "date")}
                {renderSelect("Blood Group", "blood_group", ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"])}
                {renderSelect("Marital Status", "marital_status", ["Single", "Married", "Divorced", "Widowed"])}
                {renderField("Nationality", "nationality")}
                {renderField("Religion", "religion")}
                {renderField("Race", "race")}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="employment">
            <Card>
              <CardHeader><CardTitle>Employment Details</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {renderField("Role Code", "role_code")}
                {renderField("Project/Program", "project_program")}
                {renderField("Designation", "designation")}
                {renderField("Position", "position")}
                {renderSelect("Institution", "institution_assignment", ["WES", "DPS", "CLAS", "WESA"])}
                {renderField("WES Mail", "wes_mail", "email")}
                {renderField("WES Mail Password", "wes_mail_pass")}
                {renderField("Date of Joining", "date_of_joining", "date")}
                {renderSelect("Employment Type", "employment_type", ["Full-time", "Part-time", "Contract", "Intern"])}
                {renderSelect("Employment Status", "employment_status", ["Active", "Inactive", "On Leave", "Terminated"])}
                {renderField("Engagement Type", "engagement_type")}
                {renderField("Next Increment Date", "next_increment_date", "date")}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="identity">
            <Card>
              <CardHeader><CardTitle>Identity Documents</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {renderField("Aadhar Number", "aadhar_number")}
                {renderField("PAN Number", "pan_number")}
                {renderField("Passport Number", "passport_number")}
                {renderField("Passport Expiry", "passport_expiry", "date")}
                {renderField("Driving License", "driving_license")}
                {renderField("Biometric ID", "biometric_id")}
                {renderField("Samagra ID", "samagra_id")}
                {renderField("Social Category", "social_category")}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="address">
            <Card>
              <CardHeader><CardTitle>Address Information</CardTitle></CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h3 className="font-medium mb-4">Current Address</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {renderField("House Number", "house_number")}
                    {renderField("Address", "current_address")}
                    {renderField("City", "current_city")}
                    {renderField("State", "current_state")}
                    {renderField("Pincode", "current_pincode")}
                    {renderField("Country", "country")}
                  </div>
                </div>
                <div>
                  <h3 className="font-medium mb-4">Permanent Address</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {renderField("Address", "permanent_address")}
                    {renderField("City", "permanent_city")}
                    {renderField("State", "permanent_state")}
                    {renderField("Pincode", "permanent_pincode")}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="bank">
            <Card>
              <CardHeader><CardTitle>Bank Details</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {renderField("Bank Name", "bank_name")}
                {renderField("Account Name", "bank_account_name")}
                {renderField("Account Number", "bank_account_number")}
                {renderField("IFSC Code", "bank_ifsc_code")}
                {renderField("Bank City", "bank_city")}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="education">
            <Card>
              <CardHeader><CardTitle>Education & Qualifications</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {renderField("Highest Qualification", "highest_qualification")}
                {renderField("Degree", "degree")}
                {renderField("Professional Qualification (Teaching)", "professional_qualification_teaching")}
                {renderField("University", "university")}
                {renderField("Year of Passing", "year_of_passing", "number")}
                {renderField("Training Record", "training_record")}
                {renderField("Education Worker Permit", "education_worker_permit")}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="emergency">
            <Card>
              <CardHeader><CardTitle>Emergency Contact</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {renderField("Contact Name", "emergency_contact_name")}
                {renderField("Contact Phone", "emergency_contact_phone", "tel")}
                {renderField("Relationship", "emergency_contact_relation")}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="other">
            <Card>
              <CardHeader><CardTitle>Other Information</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {renderField("Medical & Health Condition", "medical_health_condition")}
                {renderSelect("Has Driving License", "has_driving_license" as keyof ProfileData, ["true", "false"])}
                {renderField("Vehicle Information", "vehicle_information")}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="documents">
            {profile && (
              <MyDocuments 
                userId={profile.user_id} 
                isViewOnly={!isOwnProfile && role !== "admin"} 
              />
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
