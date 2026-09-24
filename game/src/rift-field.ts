import { riftBonus, type RiftTag } from './rift-content.ts';
export const RIFT_FIELD = Object.freeze({ sectors:13, sectorSize:640, packs:28, minPack:64, maxPack:96, radius:380, admissionRange:1500, retirementRange:2200, admissionInterval:.25 });
export const riftPackCount=(tag:RiftTag)=>Math.round(RIFT_FIELD.packs*(1+riftBonus(tag,'density')/100));
