using MapManager.Api.Infrastructure;
using MapManager.Api.Repositories;
using MapManager.Api.Tests.Fakes;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Hosting;

namespace MapManager.Api.Tests.Http;

/// <summary>
/// Hosts the real API pipeline (routing, validation, error handling) in memory, with the MongoDB repositories
/// replaced by in-memory ones. Nothing connects to a database.
/// </summary>
public sealed class ApiFactory : WebApplicationFactory<Program>
{
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        // Required by the fail-fast settings check. The client is never used because the repositories are replaced.
        builder.UseSetting("Mongo:ConnectionString", "mongodb://localhost:1");

        builder.ConfigureServices(services =>
        {
            // The startup work that talks to MongoDB (indexes, default layer) is not needed here.
            var mongoStartup = services
                .Where(d => d.ServiceType == typeof(IHostedService)
                    && (d.ImplementationType == typeof(MongoIndexInitializer) || d.ImplementationType == typeof(DefaultLayerSeeder)))
                .ToList();
            mongoStartup.ForEach(d => services.Remove(d));

            services.RemoveAll<IFeatureRepository>();
            services.RemoveAll<ILayerRepository>();
            services.AddSingleton<IFeatureRepository>(new InMemoryFeatureRepository());
            services.AddSingleton<ILayerRepository>(TestData.Layers());
        });
    }
}
