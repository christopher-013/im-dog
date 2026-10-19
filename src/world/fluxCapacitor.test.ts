import { AdditiveBlending, Mesh, ShaderMaterial } from 'three';
import { describe, expect, it, vi } from 'vitest';
import { DeLoreanCar } from './DeLoreanCar';
import { CoastDrive } from '../ride/CoastDrive';

describe('animated flux capacitor', () => {
  it('uses one shadow-free additive panel and updates only its time uniform, retaining/discarding resources correctly', () => {
    const car = new DeLoreanCar();
    const flux = car.object.getObjectByName('Animated flux capacitor') as Mesh<import('three').PlaneGeometry, ShaderMaterial>;
    expect(flux).toBeDefined();
    expect(flux.geometry.attributes.position!.count).toBe(4);
    expect(flux.material.blending).toBe(AdditiveBlending);
    expect(flux.material.depthWrite).toBe(false);
    expect(flux.castShadow || flux.receiveShadow).toBe(false);
    const geometry = flux.geometry, material = flux.material;
    for (const time of [1, 2, 3, 120]) {
      car.updatePresentation(time);
      expect(material.uniforms.time!.value).toBe(time);
      expect(flux.geometry).toBe(geometry);
      expect(flux.material).toBe(material);
    }
    const releaseGeometry = vi.spyOn(geometry, 'dispose'), releaseMaterial = vi.spyOn(material, 'dispose');
    car.dispose();
    expect(releaseGeometry).toHaveBeenCalledTimes(1);
    expect(releaseMaterial).toHaveBeenCalledTimes(1);
  });
  it('runs in the coast scene and freezes with its simulation clock during pause', () => {
    const drive = new CoastDrive('delorean');
    const flux = drive.car.object.getObjectByName('Animated flux capacitor') as Mesh<import('three').PlaneGeometry, ShaderMaterial>;
    drive.update(0.2, 16 / 9);
    expect(flux.material.uniforms.time!.value).toBeCloseTo(0.2);
    drive.update(0, 16 / 9);
    expect(flux.material.uniforms.time!.value).toBeCloseTo(0.2);
    drive.update(0.3, 16 / 9);
    expect(flux.material.uniforms.time!.value).toBeCloseTo(0.5);
    drive.dispose();
  });
});
