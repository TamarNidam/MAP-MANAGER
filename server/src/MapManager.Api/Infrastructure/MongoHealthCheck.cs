using Microsoft.Extensions.Diagnostics.HealthChecks;
using MongoDB.Bson;
using MongoDB.Driver;

namespace MapManager.Api.Infrastructure;

/// <summary>Reports unhealthy when MongoDB does not answer a ping.</summary>
public sealed class MongoHealthCheck : IHealthCheck
{
    private readonly MongoContext _context;

    public MongoHealthCheck(MongoContext context)
    {
        _context = context;
    }

    public async Task<HealthCheckResult> CheckHealthAsync(
        HealthCheckContext context,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var ping = new BsonDocumentCommand<BsonDocument>(new BsonDocument("ping", 1));
            await _context.Database.RunCommandAsync(ping, cancellationToken: cancellationToken);
            return HealthCheckResult.Healthy();
        }
        catch (Exception ex)
        {
            return HealthCheckResult.Unhealthy("MongoDB is unreachable.", ex);
        }
    }
}
