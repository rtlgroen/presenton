'use client'
import { useEffect, useRef, useCallback, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '@/store/store';
import { PresentationGenerationApi } from '../../services/api/presentation-generation';
import { addToHistory } from '@/store/slices/undoRedoSlice';
import type { PresentationData } from '@/store/slices/presentationGeneration';
import type { Slide } from '../../types/slide';
import type { AutoSaveSnapshot } from '../utils/autoSaveDiff';
import {
    createAutoSaveSnapshot,
    fingerprintValue,
    getAutoSaveChanges,
} from '../utils/autoSaveDiff';

interface UseAutoSaveOptions {
    debounceMs?: number;
    enabled?: boolean;
}

export const useAutoSave = ({
    debounceMs = 1000,
    enabled = true,
}: UseAutoSaveOptions = {}) => {
   
    const dispatch = useDispatch();
    const { presentationData, isStreaming, isLoading, isLayoutLoading } = useSelector(
        (state: RootState) => state.presentationGeneration
    );

    const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const acknowledgedDataRef = useRef<AutoSaveSnapshot | null>(null);
    const wasAutoSavePausedRef = useRef(false);
    const isSavingRef = useRef(false);
    const [isSaving, setIsSaving] = useState<boolean>(false);
 

    // Debounced save function
    const debouncedSave = useCallback((data: PresentationData) => {
        // Clear existing timeout
        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
        }

        // Set new timeout
        const saveWhenIdle = async () => {
            if (!data) return;
            if (isSavingRef.current) {
                saveTimeoutRef.current = setTimeout(saveWhenIdle, debounceMs);
                return;
            }

            const acknowledged = acknowledgedDataRef.current;
            if (!acknowledged || acknowledged.presentationId !== data.id) {
                acknowledgedDataRef.current = createAutoSaveSnapshot(data);
                return;
            }

            const changes = getAutoSaveChanges(acknowledged, data);
            if (
                !changes.structuralChange &&
                !changes.metadataChanged &&
                changes.changedSlides.length === 0
            ) return;

            try {
                isSavingRef.current = true;
                setIsSaving(true);
                if (changes.structuralChange || changes.changedSlides.length > 0) {
                    dispatch(addToHistory({
                        slides: data.slides,
                        actionType: "AUTO_SAVE"
                    }));
                }
                console.log('🔄 Auto-saving presentation data...');

                if (changes.structuralChange) {
                    // Add/delete/duplicate/reorder operations still require the
                    // existing full-deck replacement contract.
                    await PresentationGenerationApi.updatePresentationContent(data);
                    acknowledgedDataRef.current = createAutoSaveSnapshot(data);
                } else {
                    let firstError: unknown = null;
                    const nextAcknowledged: AutoSaveSnapshot = {
                        ...acknowledged,
                        slideFingerprints: { ...acknowledged.slideFingerprints },
                    };

                    if (changes.metadataChanged) {
                        try {
                            await PresentationGenerationApi.updatePresentationContent({
                                id: data.id,
                                title: data.title,
                                theme: data.theme,
                            });
                            nextAcknowledged.metadataFingerprint = fingerprintValue({
                                title: data.title,
                                theme: data.theme,
                            });
                            acknowledgedDataRef.current = nextAcknowledged;
                        } catch (error) {
                            firstError = error;
                        }
                    }

                    for (const slide of changes.changedSlides) {
                        try {
                            await PresentationGenerationApi.updatePresentationSlide(
                                slide as Slide
                            );
                            nextAcknowledged.slideFingerprints[slide.id] =
                                fingerprintValue(slide);
                            acknowledgedDataRef.current = nextAcknowledged;
                        } catch (error) {
                            firstError ??= error;
                        }
                    }

                    if (firstError) throw firstError;
                    acknowledgedDataRef.current = createAutoSaveSnapshot(data);
                }

                console.log('✅ Auto-save successful');

            } catch (error) {
                console.error('❌ Auto-save failed:', error);

            } finally {
                isSavingRef.current = false;
                setIsSaving(false);
            }
        };
        saveTimeoutRef.current = setTimeout(saveWhenIdle, debounceMs);
    }, [debounceMs, dispatch]);

    // Effect to trigger auto-save when presentation data changes
    useEffect(() => {
        if (!presentationData) return;

        const autoSavePaused = !enabled || isStreaming || isLoading || isLayoutLoading;

        if (autoSavePaused) {
            // Changes arriving while editing is paused are server-originated
            // hydration/streaming updates and are already persisted.
            wasAutoSavePausedRef.current = true;
            if (!isSavingRef.current) {
                acknowledgedDataRef.current = createAutoSaveSnapshot(presentationData);
            }
            if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
            return;
        }

        if (wasAutoSavePausedRef.current) {
            // The final streaming/loading payload can land in the same render
            // that flips editing back on. Treat that first active snapshot as
            // already persisted instead of issuing slide updates for it.
            wasAutoSavePausedRef.current = false;
            acknowledgedDataRef.current = createAutoSaveSnapshot(presentationData);
            if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
            return;
        }

        if (
            !acknowledgedDataRef.current ||
            acknowledgedDataRef.current.presentationId !== presentationData.id
        ) {
            acknowledgedDataRef.current = createAutoSaveSnapshot(presentationData);
            return;
        }
        
        // Trigger debounced save
        debouncedSave(presentationData);
       
        // Cleanup timeout on unmount
        return () => {
            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current);
            }
        };
    }, [presentationData, enabled, debouncedSave,isLoading, isStreaming, isLayoutLoading]);
    
    return {
        isSaving,
    };
};
