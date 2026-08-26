import React, { useState, useRef, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Trash2, ArrowRight, Play, CheckCircle2, ListFilter, RotateCcw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const stepSchema = z.object({
  name: z.string().min(1, "Name is required"),
  order: z.number().int().min(1),
  entered: z.coerce.number({ error: "Must be a number" }).int("Must be integer").min(1, "Must be > 0"),
  converted: z.coerce.number({ error: "Must be a number" }).int("Must be integer").min(0, "Must be >= 0"),
  description: z.string().optional().default(""),
}).refine(data => data.converted <= data.entered, {
  message: "Converted cannot exceed entered",
  path: ["converted"]
});

const formSchema = z.object({
  steps: z.array(stepSchema)
    .min(3, "At least 3 steps required")
    .max(6, "Maximum 6 steps allowed")
}).refine(data => {
  const orders = data.steps.map(s => s.order);
  return new Set(orders).size === orders.length;
}, {
  message: "Step orders must be unique",
  path: ["steps"]
});

type FormValues = z.infer<typeof formSchema>;

const initialSteps = [
  { name: 'Visited Site', order: 1, entered: 10000, converted: 8000, description: 'Landed on homepage' },
  { name: 'Signed Up', order: 2, entered: 8000, converted: 2000, description: 'Created an account' },
  { name: 'Purchased', order: 3, entered: 2000, converted: 150, description: 'Completed checkout' },
];

export function FunnelBuilder() {
  const [isReady, setIsReady] = useState(false);
  const [summaryData, setSummaryData] = useState<FormValues | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      steps: initialSteps
    },
    mode: 'onChange',
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "steps"
  });

  // Keep order synchronized with the visual index
  useEffect(() => {
    const subscription = form.watch((value, { name, type }) => {
      if (type === 'change') return; // We only care about append/remove/swap
      
      const currentSteps = form.getValues().steps;
      let needsUpdate = false;
      
      currentSteps.forEach((step, index) => {
        if (step.order !== index + 1) {
          needsUpdate = true;
        }
      });
      
      if (needsUpdate) {
        const updatedSteps = currentSteps.map((step, index) => ({
          ...step,
          order: index + 1
        }));
        form.setValue("steps", updatedSteps, { shouldValidate: true });
      }
    });
    return () => subscription.unsubscribe();
  }, [form]);

  const onSubmit = (data: FormValues) => {
    setSummaryData(data);
    setIsReady(true);
  };

  const handleReset = () => {
    setIsReady(false);
    setSummaryData(null);
  };

  if (isReady && summaryData) {
    return (
      <div className="w-full max-w-4xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <Card className="border-primary/20 shadow-md">
          <CardHeader className="bg-primary/5 rounded-t-xl border-b border-primary/10">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center text-primary">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <CardTitle className="text-xl">Funnel Ready for Analysis</CardTitle>
                <CardDescription>
                  Your funnel configuration is valid and ready to be processed.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-4">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Step Summary</h3>
              <div className="grid gap-2">
                {summaryData.steps.map((step, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg border border-border/50">
                    <div className="flex items-center gap-4">
                      <Badge variant="outline" className="w-6 h-6 p-0 flex items-center justify-center rounded-full font-mono text-xs">
                        {step.order}
                      </Badge>
                      <div>
                        <div className="font-medium text-sm">{step.name}</div>
                        {step.description && <div className="text-xs text-muted-foreground">{step.description}</div>}
                      </div>
                    </div>
                    <div className="flex items-center gap-6 text-sm font-mono">
                      <div className="text-right">
                        <div className="text-muted-foreground text-xs uppercase tracking-wider font-sans mb-1">Entered</div>
                        <div>{step.entered.toLocaleString()}</div>
                      </div>
                      <ArrowRight className="w-4 h-4 text-muted-foreground/50 mt-4" />
                      <div className="text-right">
                        <div className="text-muted-foreground text-xs uppercase tracking-wider font-sans mb-1">Converted</div>
                        <div className="font-semibold text-primary">{step.converted.toLocaleString()}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex justify-between border-t border-border/50 bg-muted/20 p-6 rounded-b-xl">
            <Button variant="outline" onClick={handleReset} className="font-medium">
              <RotateCcw className="w-4 h-4 mr-2" />
              Edit Steps
            </Button>
            <Button size="lg" className="font-semibold shadow-md active-elevate" disabled>
              Run Diagnostic Analysis
              <Play className="w-4 h-4 ml-2" />
            </Button>
          </CardFooter>
        </Card>
        <p className="text-center text-sm text-muted-foreground">
          Analysis execution is disabled for this diagnostic phase.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight mb-2">Funnel Configuration</h1>
        <p className="text-muted-foreground">
          Define your funnel steps and raw counts. The diagnostic engine requires exact user drop-off volumes to pinpoint anomalies.
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          
          <div className="bg-card border border-border shadow-sm rounded-xl overflow-hidden">
            <div className="grid grid-cols-[3rem_1fr_1fr_1fr_3rem] gap-4 p-4 border-b border-border bg-muted/30 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <div className="text-center">Step</div>
              <div>Event Name</div>
              <div>Entered Count</div>
              <div>Converted Count</div>
              <div></div>
            </div>
            
            <div className="divide-y divide-border/50">
              {fields.map((field, index) => (
                <div key={field.id} className="grid grid-cols-[3rem_1fr_1fr_1fr_3rem] gap-4 p-4 items-start bg-card transition-colors hover:bg-muted/10 group">
                  <div className="flex items-center justify-center pt-2">
                    <Badge variant="secondary" className="w-6 h-6 p-0 flex items-center justify-center rounded-full font-mono text-xs font-medium">
                      {index + 1}
                    </Badge>
                  </div>
                  
                  <div className="space-y-3">
                    <FormField
                      control={form.control}
                      name={`steps.${index}.name`}
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Input placeholder="e.g. Visited Site" className="font-medium bg-transparent shadow-none focus-visible:ring-1 focus-visible:bg-background" {...field} />
                          </FormControl>
                          <FormMessage className="text-xs" />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`steps.${index}.description`}
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Input placeholder="Description (optional)" className="h-8 text-xs text-muted-foreground bg-transparent border-transparent shadow-none focus-visible:border-input focus-visible:ring-1 focus-visible:bg-background" {...field} />
                          </FormControl>
                          <FormMessage className="text-xs" />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name={`steps.${index}.entered`}
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Input type="number" className="font-mono bg-transparent shadow-none focus-visible:ring-1 focus-visible:bg-background" {...field} />
                        </FormControl>
                        <FormMessage className="text-xs" />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name={`steps.${index}.converted`}
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Input type="number" className="font-mono bg-transparent shadow-none focus-visible:ring-1 focus-visible:bg-background font-semibold text-primary" {...field} />
                        </FormControl>
                        <FormMessage className="text-xs" />
                      </FormItem>
                    )}
                  />

                  <div className="flex items-center justify-center pt-1">
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="icon" 
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      onClick={() => remove(index)}
                      disabled={fields.length <= 3}
                      title={fields.length <= 3 ? "Minimum 3 steps required" : "Remove step"}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="p-4 bg-muted/10 border-t border-border flex items-center justify-between">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => append({ name: '', order: fields.length + 1, entered: '' as any, converted: '' as any, description: '' })}
                disabled={fields.length >= 6}
                className="font-medium bg-background"
              >
                <Plus className="h-4 w-4 mr-1.5" />
                Add Step
              </Button>
              <div className="text-xs text-muted-foreground font-medium flex items-center gap-2">
                <ListFilter className="h-3.5 w-3.5" />
                {fields.length} / 6 steps configured
              </div>
            </div>
          </div>

          {form.formState.errors.steps?.root && (
            <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-md font-medium border border-destructive/20">
              {form.formState.errors.steps.root.message}
            </div>
          )}

          <div className="flex justify-end pt-4">
            <Button type="submit" size="lg" className="min-w-[160px] font-semibold shadow-sm hover-elevate active-elevate">
              Validate Data
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
