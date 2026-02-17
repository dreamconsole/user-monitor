import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AppUsageDashboard from './AppUsageDashboard';
import AppCategories from './AppCategories';
import AppMapping from './AppMapping';
import useAuthStore from '@/lib/useAuthStore';
import { Card, CardContent } from '@/components/ui/card';

export default function AppManagement() {
    const { user } = useAuthStore();
    const isOrgAdmin = user?.role === 'orgadmin';

    // If not admin, they only see App Usage, so no need for tabs really, 
    // but to keep it consistent we can still show tabs or just render Dashboard.
    // However, the request implies consolidating these for someone who can see them.
    // Users can only see App Usage.

    if (!isOrgAdmin) {
        return <AppUsageDashboard />;
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold tracking-tight">App Management</h1>
                <p className="text-muted-foreground">Monitor usage, categorize applications, and manage mappings.</p>
            </div>

            <Tabs defaultValue="usage" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="usage">App Usage</TabsTrigger>
                    <TabsTrigger value="categories">Categories</TabsTrigger>
                    <TabsTrigger value="mapping">App Mapping</TabsTrigger>
                </TabsList>

                <TabsContent value="usage" className="space-y-4">
                    <div className="border rounded-lg p-0">
                        {/* We might need to adjust AppUsageDashboard to fit better if it has its own padding/headers */}
                        <AppUsageDashboard />
                    </div>
                </TabsContent>

                <TabsContent value="categories" className="space-y-4">
                    <Card>
                        <CardContent className="pt-6">
                            <AppCategories />
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="mapping" className="space-y-4">
                    <Card>
                        <CardContent className="pt-6">
                            <AppMapping />
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
